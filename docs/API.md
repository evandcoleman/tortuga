# API reference

All routes are under `/api`. Webhook, healthz, unsubscribe, and auth routes are
public; everything else is protected per `AUTH_MODE` (see the
[README](../README.md#authentication)).

## POST `/api/digests/run`

Triggers a digest run. This is the same pipeline used by the scheduler and the
**Send now** button.

### Authorization

Authorized if **any** of these hold:

- `AUTH_MODE=forward` and the request carries the `AUTH_FORWARD_HEADER`
  (default `Remote-User`) — i.e. it came through the trusted proxy; **or**
- the `Authorization: Bearer <token>` header matches `DIGEST_RUN_TOKEN`
  (only when `DIGEST_RUN_TOKEN` is configured); **or**
- a valid logged-in session exists (`AUTH_MODE=session`).

Otherwise the endpoint returns `401 {"error":"unauthorized"}`.

Use the bearer token for unattended callers (external cron, Nomad periodic
batch). The UI button relies on the logged-in session, so no token is needed
there.

### Request

```
POST /api/digests/run
Authorization: Bearer <DIGEST_RUN_TOKEN>
Content-Type: application/json

{ "dry_run": true }
```

| Body field | Type | Default | Effect |
|---|---|---|---|
| `dry_run` | boolean | `false` | When `true`, renders the digest but sends nothing. |

A missing or non-JSON body is treated as `{}` (`dry_run=false`).

### Response

- `200` — JSON result of `runDigest` (recipients, counts, send status, etc).
- `401` — unauthorized.
- `500` — `{"error":"<message>"}` if the run throws.

### Examples

Dry run (safe to test cron wiring):

```bash
curl -X POST "$APP_URL/api/digests/run" \
  -H "Authorization: Bearer $DIGEST_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

Real send via token:

```bash
curl -X POST "$APP_URL/api/digests/run" \
  -H "Authorization: Bearer $DIGEST_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

## GET `/api/healthz`

Public liveness/readiness probe. No auth.

Checks the SQLite connection and Tautulli reachability, reports the configured
email provider name (not pinged), the scheduler's jobs with next-run times, and
the most recent digest's status.

Status semantics:

- `db` / `tautulli`: `"ok"` or `"fail"`.
- Top-level `status`: `"fail"` (HTTP `503`) if any core check failed;
  `"degraded"` (HTTP `200`) if the last digest's status is `failed`; otherwise
  `"ok"` (HTTP `200`).

Example payload:

```json
{
  "status": "ok",
  "ts": "2026-05-28T20:00:00.000Z",
  "db": "ok",
  "tautulli": "ok",
  "email_provider": "resend",
  "scheduler": {
    "schedule_enabled": true,
    "jobs": [
      { "name": "newsletter.digest", "cron": "0 9 * * SUN", "nextRun": "2026-05-31T13:00:00.000Z" }
    ]
  },
  "last_digest": {
    "status": "sent",
    "scheduledAt": "2026-05-24T13:00:00.000Z",
    "error": null
  }
}
```

`nextRun` is `null` when a job is stopped or has no future run. `last_digest`
is `null` if no digest has run yet, and its `error` is truncated to 500
characters. On an internal error the route returns
`500 {"status":"fail","ts":...,"error":...}`.

```bash
curl "$APP_URL/api/healthz"
```

## POST `/api/webhooks/resend`

Receives Resend delivery events. Public route, but signature-verified.

- Returns `404` if the deployed provider is not `resend`.
- Returns `401` if `RESEND_WEBHOOK_SECRET` is unset or the `Resend-Signature`
  header fails HMAC-SHA256 verification (timestamp tolerance 300s).
- On success: stores the raw event in `send_events`; for terminal types
  (`delivered`, `bounced`, `complained`, `failed`) updates the matching `sends`
  row by `providerMessageId`. Returns `{ "ok": true }`.

Event type mapping: `email.delivered→delivered`, `email.bounced→bounced`,
`email.complained→complained`, `email.failed→failed`; others stored as `other`.

## POST `/api/webhooks/mailgun`

Receives Mailgun delivery events. Public route, but signature-verified.

- Returns `404` if the deployed provider is not `mailgun`.
- Returns `401` if `MAILGUN_WEBHOOK_SIGNING_KEY` is unset or the in-body
  signature (`signature: { timestamp, token, signature }`) fails HMAC-SHA256
  verification of `<timestamp><token>`.
- On success: same `send_events` insert and terminal-status `sends` update as
  Resend. Returns `{ "ok": true }`.

See [EMAIL-PROVIDERS.md](EMAIL-PROVIDERS.md) for configuring the webhook
endpoints and signing keys.

## GET `/api/unsubscribe?token=<token>`

Public. One-time unsubscribe link embedded in digest emails. Verifies the
HMAC token against `SESSION_SECRET`; on success marks the recipient inactive
and the token used, returning an HTML confirmation page. Invalid or
already-used tokens return an HTML error page with `400`.
