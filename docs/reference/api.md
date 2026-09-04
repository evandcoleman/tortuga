# API reference

All routes are under `/api`, plus two page-adjacent routes handled outside
`/api`: `/issues/[slug]` (hosted newsletter issues) and `/preferences`
(recipient preference management). Webhook, healthz, unsubscribe, preferences,
and auth routes are public; everything else requires an authenticated admin
(see [Configuration overview](../configuration/index.md) for `AUTH_MODE`).

Two admin-auth patterns appear below:

- **Server-action style** (`requireAdminSession()`,
  `src/kernel/auth/require-admin-session.ts`): in `forward` mode, requires the
  configured forward-auth header (default `Remote-User`) on the request; in
  `session` mode, requires a valid NextAuth session. Throws `UnauthorizedError`,
  which every route below catches and turns into `401 {"error":"unauthorized"}`.
- **`/api/digests/run`'s own check** (below) branches on `AUTH_MODE` instead
  of using either of the above patterns directly.

## POST `/api/digests/run`

Triggers a digest run — the same pipeline used by the scheduler and the
**Send now** button.

### Authorization

`isAuthorized()` in `src/app/api/digests/run/route.ts` branches on
`AUTH_MODE`, it does not OR all three checks together:

- **`AUTH_MODE=forward`**: authorized only if the request carries the
  `AUTH_FORWARD_HEADER` (default `Remote-User`) header with a non-empty value
  (not itself verified here; the reverse proxy is trusted to have done that).
  This check returns immediately — `DIGEST_RUN_TOKEN` and session cookies are
  **not** consulted in forward mode, even if present.
- **`AUTH_MODE=session`** (the default): authorized if the
  `Authorization: Bearer <token>` header matches `DIGEST_RUN_TOKEN` (only
  possible when `DIGEST_RUN_TOKEN` is configured), **or** a valid logged-in
  session exists (checked via `auth()`).

Otherwise the endpoint returns `401 {"error":"unauthorized"}`.

::: warning Bearer tokens do not work under `AUTH_MODE=forward`
`DIGEST_RUN_TOKEN` is only checked when `AUTH_MODE=session`. Deployments that
use forward-auth (e.g. behind Authelia/Traefik) cannot trigger this route with
a bearer token — an external cron / Nomad periodic job must either present the
configured `AUTH_FORWARD_HEADER` itself (trusting the caller the same way the
reverse proxy would) or run inside the network boundary the reverse proxy
already treats as authenticated. There is no code path that accepts a bearer
token in forward mode.
:::

Use the bearer token for unattended callers when running in `session` mode.
The UI's **Send now** button relies on the logged-in session, so no token is
needed there.

### Request

```
POST /api/digests/run
Authorization: Bearer <DIGEST_RUN_TOKEN>
Content-Type: application/json

{ "dry_run": true }
```

| Body field | Type | Default | Effect |
|---|---|---|---|
| `dry_run` | boolean | `false` | When `true`, renders the digest but sends nothing (`dryRun` is threaded straight into `runDigest()`). |

A missing or non-JSON body is treated as `{}` (`dry_run=false`).

### Response

- `200` — JSON result of `runDigest()` (recipients, counts, send status, etc).
- `401` — `{"error":"unauthorized"}`.
- `500` — `{"error":"digest run failed"}` if the run throws (the underlying
  error is logged server-side, not returned to the caller).

### Examples

```bash
# Dry run (safe to test cron wiring)
curl -X POST "$APP_URL/api/digests/run" \
  -H "Authorization: Bearer $DIGEST_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'

# Real send via token
curl -X POST "$APP_URL/api/digests/run" \
  -H "Authorization: Bearer $DIGEST_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

## GET `/api/healthz`

Public liveness/readiness probe. No auth. Always `force-dynamic`.

Checks the SQLite connection (`select 1`) and Tautulli reachability
(`getUsers()`, only if a Tautulli client is configured), reports the
configured email provider's name (not pinged, `null` if unconfigured), the
scheduler's **job count only** (no job names or cron expressions — deliberately
withheld from this unauthenticated route to avoid leaking internal scheduling
details), and the most recently scheduled digest's status.

Status semantics:

- `db` / `tautulli`: `"ok"` or `"fail"` (`"fail"` for tautulli if unconfigured
  or the ping throws).
- Top-level `status`: `"fail"` (HTTP `503`) if any core check (`db`/`tautulli`)
  failed; `"degraded"` (HTTP `200`) if the last digest's status is `failed`;
  otherwise `"ok"` (HTTP `200`).
- An uncaught error anywhere in the handler returns `500` with
  `{"status":"fail","ts":...,"error":"<String(err)>"}`.

Exact success payload shape:

```json
{
  "status": "ok",
  "ts": "2026-05-28T20:00:00.000Z",
  "db": "ok",
  "tautulli": "ok",
  "email_provider": "resend",
  "scheduler": {
    "schedule_enabled": true,
    "job_count": 3
  },
  "last_digest": {
    "status": "sent",
    "scheduledAt": "2026-05-24T13:00:00.000Z"
  }
}
```

Three cron jobs register normally: `newsletter.digest`, `announcements.scheduled`
(`src/modules/announcements/module.ts`), and `alerts.sweep`
(`src/modules/alerts/module.ts`). `job_count` drops to `2` when
`newsletter.schedule_enabled` is `false`, since `newsletter.digest` is the only one
gated by that flag.

`last_digest` is `null` if no digest row exists yet. There is no `error` field
on `last_digest` in the current implementation.

```bash
curl "$APP_URL/api/healthz"
```

## POST `/api/webhooks/resend`

Receives Resend delivery events. Public route, but signature-verified.

- Returns `404` if the deployed email provider is not `resend`.
- Returns `401` if the resolved `resend.webhook_secret` (env `RESEND_WEBHOOK_SECRET`
  or the DB-stored service setting) is unset, or the `Resend-Signature` header
  (`t=<ts>,v1=<hmac>`) fails HMAC-SHA256 verification of `<ts>.<body>` (300s
  timestamp tolerance).
- On success: stores the raw event in `send_events`; for terminal types
  (`delivered`, `bounced`, `complained`, `failed`) updates the matching `sends`
  row by `providerMessageId`; suppresses the recipient on `complained` or a
  `permanent` `bounced`. Returns `{ "ok": true }`.
- Returns `400 {"error":"malformed payload"}` if the (already-verified) body
  can't be parsed into an event.

Event type mapping: `email.delivered→delivered`, `email.bounced→bounced`,
`email.complained→complained`, `email.failed→failed`; others stored as `other`.

## POST `/api/webhooks/mailgun`

Receives Mailgun delivery events. Public route, but signature-verified.

- Returns `404` if the deployed email provider is not `mailgun`.
- Returns `401` if the resolved `mailgun.webhook_signing_key` is unset, or the
  in-body signature (`signature: { timestamp, token, signature }`) fails
  HMAC-SHA256 verification of `<timestamp><token>` (300s timestamp tolerance).
- On success: same `send_events` insert and terminal-status `sends` update as
  Resend; suppresses the recipient on `bounced` (Mailgun `permanent_fail`) or
  `complained`. Returns `{ "ok": true }`.
- Returns `400 {"error":"malformed payload"}` on unparseable body.

See [Email providers](../guide/email-providers.md) for configuring the webhook
endpoints and signing keys, and the exact suppression rules.

## GET `/api/unsubscribe?token=<token>`

Public. One-time unsubscribe link embedded in digest and announcement emails.
Verifies the HMAC token against `SESSION_SECRET` and atomically claims it
(only the request that flips `usedAt` from `NULL` wins — guards a
concurrent-click race). On success, opts the recipient out of the token's
message category (`digest` or `announcements`) and returns an HTML
confirmation page with resubscribe / opt-out-of-the-other-category / manage
preferences actions. Invalid or already-used tokens return an HTML error page
with `400`.

Manual unsubscribe never sets `active=false` — that flag is reserved for hard
suppression (bounce, complaint) and carries a stored reason.

## POST `/api/unsubscribe?token=<token>`

Public. RFC 8058 one-click unsubscribe: mail clients POST
`List-Unsubscribe=One-Click` with no user interaction and expect a bare status
with no body — same claim logic as the `GET`, but returns `200` (success) or
`400` (invalid/already-used) with an empty body instead of an HTML page.

## POST `/api/unsubscribe/resubscribe`

Public. Form fields `token` (a *preferences* token, not the one-shot
unsubscribe token — `verifyPreferencesToken`), `category`
(`digest` | `announcements`), `enabled` (`"true"` | anything else = false).
Flips one category for the recipient (`setCategory`). Returns `403` (HTML) if
the recipient is hard-suppressed (`recipients_cache.active === false`) —
suppression cannot be undone by resubscribing. Returns `400` (HTML) for an
invalid/expired token or unrecognized category.

## GET / POST `/preferences?token=<token>`

Public, reachable on both the admin host and the portal domain (the portal
host's middleware special-cases this path so mailed links work from any
network). The "Manage preferences" link in every email footer carries a
reusable preferences token. `GET` renders category checkboxes (digest,
announcements) plus one checkbox per library in `newsletter.include_libraries`
(only enforced if that list is non-empty — validated server-side with a zod
refine against the current config). `POST` validates and upserts
`recipient_preferences`; selecting every listed library (or when
`include_libraries` is empty) stores `libraries: null` (meaning "all").
Hard-suppressed recipients see an explanation (`200`, not an error status)
instead of a form on both `GET` and `POST`.

## GET `/issues/[slug]`

Serves the immutable web-variant HTML snapshot of a hosted newsletter issue.
No `/api` prefix.

- `sent` digests are **public** — anyone with the (unguessable) slug can view
  them.
- `rendered` (not-yet-sent) digests are **admin-only previews** — 404 (not
  `401`) for unauthenticated requests, so an outsider can't distinguish
  "unpublished draft" from "unknown slug".
- Any other status, a missing slug, or a missing `webHtml` also 404s.
- Success: `200`, `content-type: text/html; charset=utf-8`, raw stored HTML.

```bash
curl "$APP_URL/issues/2026-05-24-abc123"
```

## Templates (`/api/templates`)

All require `requireAdminSession()`.

### GET `/api/templates`

`200 { "templates": [...] }` — full list, no pagination.

### POST `/api/templates`

Body validated against `createTemplateSchema` (`src/modules/templates/validation.ts`).

- `201 { "template": {...} }` on success.
- `400 { "error": "<first zod issue message>" }` on invalid body.
- `409 { "error": "<message>" }` if the slug already exists (`DuplicateSlugError`).
- `500 { "error": "template create failed" }` on unexpected failure.

### GET `/api/templates/[slug]`

`200 { "template": {...} }`, or `404 { "error": "not found" }`.

### PATCH `/api/templates/[slug]`

Body validated against `updateTemplateSchema`. `200 { "template": {...} }`,
`400` on invalid body, `404` if the slug doesn't exist.

### DELETE `/api/templates/[slug]`

`204` (empty body) on success. `409 { "error": "<message>" }` if the template
is undeletable (`UndeletableTemplateError` — e.g. a system template).
`404 { "error": "not found" }` otherwise-missing slug. `500` on unexpected
failure.

### POST `/api/templates/[slug]/preview`

Renders a template with substitutions applied, without sending. Body
(`previewTemplateSchema`): optional `subject`/`body` overrides (falls back to
the stored template's), optional `name`/`email` (falls back to
`preview@tortuga.local`). Response: `200` with the rendered
`{ subject, html, ... }` (whatever `renderTemplate()` returns). `400` on
invalid body, `404` if the slug doesn't exist.

```bash
curl -X POST "$APP_URL/api/templates/welcome/preview" \
  -H "Cookie: <admin session cookie>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Ripley"}'
```

## Invites (`/api/invites`)

All require `requireAdminSession()`.

### GET `/api/invites`

`200 { "invites": [...] }` — full list.

### POST `/api/invites`

Sends a Plex library-share invite and welcome email. Requires Plex (`PLEX_TOKEN`
+ `newsletter.plex.server_id`) and an email provider to be configured; returns
`409` with an explanatory message if either is missing. Body:
`{ "email": "<valid email>", "sectionIds": ["<library id>", ...] }`
(`sectionIds` must be non-empty).

- `400 { "error": "<message>" }` — invalid body.
- `201 { "status": "sent" }` — Plex invite and welcome email both succeeded.
- `207 { "status": "invited_welcome_failed", "welcomeError": "<message>" }` —
  Plex invite succeeded but the welcome email failed to send; never rolled
  back (use the resend endpoint below).
- `409 { "error": "<message>" }` — refused as a duplicate or because the
  recipient is suppressed.
- `502 { "error": "<message>" }` — the Plex API call itself failed.

### DELETE `/api/invites/[email]`

Cancels a pending invite: revokes it on plex.tv if still found there, and
marks the local row cancelled.

- `404 { "error": "invite not found locally or on plex.tv" }` if neither
  exists.
- `502 { "error": "<message>" }` if the plex.tv cancel call fails.
- `200 { "status": "cancelled" }` on success.

### POST `/api/invites/[email]/resend`

Resends the welcome email for an existing invite (used after
`invited_welcome_failed`, or on demand). Requires an email provider (`409` if
missing). If no local invite row exists, falls back to checking whether the
email is still pending on plex.tv before proceeding (otherwise `404`).
Refuses (`409`) if the matching recipient is deactivated. `502` if the send
itself fails; `200 { "status": "sent" }` on success.

## POST `/api/recipients/[email]/welcome`

Requires `requireAdminSession()`. Manually (re-)sends the welcome email to an
**existing recipient row** (covers users invited outside Tortuga, flagged
"not welcomed" by the Tautulli sync) — never auto-triggered. Requires an email
provider (`409` if missing) and an existing, active recipient row
(`404` if missing, `409` if deactivated). `502` on send failure,
`200 { "status": "sent" }` on success.

## NextAuth (`/api/auth/[...nextauth]`)

`GET`/`POST` delegate directly to NextAuth's generated handlers
(`src/kernel/auth/auth.ts`). Only relevant in `AUTH_MODE=session`; covers
sign-in, sign-out, session, and CSRF endpoints per the NextAuth route
contract. Not used in `forward` mode, where the reverse proxy performs auth.

## Related

- [Configuration overview](../configuration/index.md)
- [Email providers](../guide/email-providers.md)
- [Guide: recipients](../guide/recipients.md)
- [Guide: invites](../guide/invites.md)
