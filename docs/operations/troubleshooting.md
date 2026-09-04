# Troubleshooting

## Container exits immediately on startup

Almost always a failed environment or config validation — Tortuga fails fast rather than
starting with bad config. Check `docker compose logs tortuga` (or `docker logs tortuga`)
for one of:

- `Invalid environment: <field>: <message>; ...` — one or more env vars failed Zod
  validation. Common causes: `SESSION_SECRET` under 32 characters, `APP_URL` or
  `TAUTULLI_URL` not a valid URL, `ADMIN_PASSWORD` under 8 characters,
  `DIGEST_RUN_TOKEN` under 16 characters.
- `tortuga.yml not found at <path>; required for v1` — no file at `CONFIG_PATH` (default
  `/config/tortuga.yml`). Copy `tortuga.example.yml` into the mounted `/config` volume.
- `Invalid tortuga.yml: <field>: <message>; ...` — the YAML parsed but failed schema
  validation (e.g. a missing `newsletter.from.email`, or `newsletter.email.provider:
  mailgun` without `newsletter.email.mailgun.domain`).

See [Environment variables](/configuration/environment) and
[tortuga.yml reference](/configuration/tortuga-yml) for the full schemas.

## `/api/healthz` reports `degraded` or `fail`

`GET /api/healthz` returns:

- `"ok"` (HTTP 200) — database and Tautulli checks passed.
- `"degraded"` (HTTP 200) — core checks passed, but the most recent digest run has status
  `failed`. Check the digest history in the admin UI or the container logs around the
  scheduled send time.
- `"fail"` (HTTP 503, or 500 on an unhandled error) — the database or Tautulli check
  failed. `checks.db: "fail"` means the SQLite file at `DATABASE_URL` isn't reachable/
  writable; `checks.tautulli: "fail"` means Tortuga couldn't reach Tautulli, or Tautulli
  isn't configured at all.

See the [`/api/healthz` reference](/reference/api#get-apihealthz) for the full payload.

## Webhook endpoint returns 401

`POST /api/webhooks/resend` and `POST /api/webhooks/mailgun` return `401` when:

- The relevant webhook secret isn't configured (`RESEND_WEBHOOK_SECRET` /
  `MAILGUN_WEBHOOK_SIGNING_KEY`, or the equivalent service setting) — the endpoint refuses
  to accept unverifiable webhooks rather than trusting them blindly.
- The request's signature doesn't verify against the configured secret — check that the
  secret in Tortuga matches the one configured in your Resend/Mailgun webhook settings.

They return `404` if the active email provider isn't the one the webhook is for (e.g. a
Mailgun webhook hitting a Resend-configured deployment).

## Login fails or never appears

- **In `session` mode** (the default): if no login page appears at all, check `AUTH_MODE`
  is unset or `session`. If credentials are rejected, confirm the admin user was actually
  bootstrapped — that only happens **once, when the users table is empty**, from
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` at startup. If you started the container once without
  those vars set, add them and restart; if a user already exists, the vars are ignored.
- **In `forward` mode:** there's no built-in login page — `AUTH_MODE=forward` expects your
  reverse proxy to authenticate the request and forward the configured header
  (`AUTH_FORWARD_HEADER`, default `Remote-User`). Requests without that header get an
  immediate `401 Unauthorized` from Tortuga's middleware, before reaching the app. See
  [Deployment: forward auth](/operations/deployment#forward-auth-auth-mode-forward).

## Portal domain doesn't route to the portal

The [portal](/guide/portal) is only served on the exact hostname configured at
`portal.domain` in `tortuga.yml` (or its DB override) — matched case-insensitively against
the incoming `Host` header, ignoring any port. If `portal.enabled` is `false`, or the
`Host` header doesn't match `portal.domain` exactly, requests fall through to normal admin
routing instead (which will 401/show the login page for a browser hitting `/`). Confirm
your reverse proxy forwards the original `Host` header unchanged, and that DNS for that
hostname points at the same upstream as your admin hostname.

## More log detail

Set `LOG_LEVEL=debug` (or `trace`) and restart the container to see verbose `pino` output.

## Migration or database errors

Migration files in `drizzle/` are baked into the image and applied automatically at
startup. If startup fails partway through a migration, inspect
`docker compose logs tortuga` for the specific error and check that `/config` is writable.
Do not hand-edit files under `drizzle/meta/`.

## Related

- [Environment variables](/configuration/environment)
- [tortuga.yml reference](/configuration/tortuga-yml)
- [Deployment](/operations/deployment)
- [API reference](/reference/api)
