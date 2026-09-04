# Environment variables

Every variable Tortuga reads: those validated by `src/kernel/config/schema.ts` (`EnvSchema`), the
process-level variables set by the Docker image and read directly via `process.env` elsewhere in
the app (including `AUTH_MODE`/`AUTH_FORWARD_HEADER`, read again outside `EnvSchema` in
`src/middleware.ts` and admin route guards), plus `AUTH_SECRET`, which Auth.js reads directly from
`process.env` and which Tortuga's own schema never touches.

::: tip Empty string = unset
For every "optional secret" field below, `FOO=""` is treated identically to `FOO` being absent —
this lets you keep a placeholder line in `.env` without accidentally supplying an empty-but-present
value.
:::

## Core / required

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `APP_URL` | yes | — | Public base URL Tortuga uses to build links (unsubscribe, preferences, hosted issues). | Must be a valid URL. |
| `SESSION_SECRET` | yes | — | Signs unsubscribe/preferences tokens (`src/kernel/email/hmac-token.ts`) and derives the AES-256-GCM encryption key for DB-stored service settings (`src/kernel/config/service-settings.ts`). | Minimum 32 characters. Rotating it invalidates outstanding tokens and DB-stored secrets. Does **not** sign login sessions — see `AUTH_SECRET` below. |

## Auth

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `AUTH_MODE` | no | `session` | Selects auth strategy: `session` (NextAuth login) or `forward` (trust an upstream reverse-proxy header). | Enum: `forward` \| `session`. |
| `AUTH_SECRET` | required when `AUTH_MODE=session` | — | Signs and encrypts NextAuth session cookies/JWTs (read directly by Auth.js, not by Tortuga's own `EnvSchema`). | Minimum 32 characters recommended; generate with `openssl rand -base64 32`. Auth.js throws `MissingSecret` at login time if unset in session mode. Not read/needed in `forward` mode. |
| `AUTH_FORWARD_HEADER` | no | `Remote-User` | Header name middleware/actions check for a value in `forward` mode. | |
| `ADMIN_EMAIL` | no | — | Bootstraps an initial admin user on first boot (session mode only). | Must be a valid email; requires `ADMIN_PASSWORD` too. |
| `ADMIN_PASSWORD` | no | — | Password for the bootstrapped admin user. | Minimum 8 characters. |

## Database / config file

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | no | `file:/config/tortuga.db` | SQLite database location. | |
| `CONFIG_PATH` | no | `/config/tortuga.yml` | Path to `tortuga.yml`. Missing file is a hard startup error. | |

## Logging

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `LOG_LEVEL` | no | `info` | pino log level. | Free-form string (e.g. `debug`, `warn`). |

## Digest trigger

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `DIGEST_RUN_TOKEN` | no | — | Bearer token accepted by `POST /api/digests/run` for unattended external callers. | Minimum 16 characters when set. Only consulted in `session` mode — see the warning in [API reference](../reference/api.md#post-apidigestsrun). |

## Service settings (env overrides DB-stored value; see configuration/index.md)

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `TAUTULLI_URL` | no | — | Tautulli base URL. | Must be a valid URL if set. |
| `TAUTULLI_API_KEY` | no | — | Tautulli API key. | |
| `TMDB_API_KEY` | no | — | TMDB API key for artwork/ratings. | |
| `MAINTAINERR_URL` | no | — | Maintainerr base URL (leaving-soon data). | Must be a valid URL if set. |
| `RESEND_API_KEY` | no | — | Resend API key. | |
| `RESEND_WEBHOOK_SECRET` | no | — | Resend webhook signing secret. | Distinct from `RESEND_API_KEY` — see [Email providers](../guide/email-providers.md). |
| `MAILGUN_API_KEY` | no | — | Mailgun private API key. | |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | no | — | Mailgun webhook signing key. | Distinct from `MAILGUN_API_KEY`. |
| `ANTHROPIC_API_KEY` | no | — | Anthropic key for AI commentary (`newsletter.commentary.provider: anthropic`). | |
| `OPENAI_API_KEY` | no | — | OpenAI key for AI commentary (`newsletter.commentary.provider: openai`). | |
| `PLEX_TOKEN` | no | — | Plex auth token; required (with `newsletter.plex.server_id`) for "Open in Plex" links and sending invites. | |

## Process / container (Dockerfile, not `EnvSchema`)

| Name | Required | Default | Purpose | Notes |
|---|---|---|---|---|
| `NODE_ENV` | no | `production` (image) | Standard Next.js environment flag. | Set in the Dockerfile, not user-configurable in the image. |
| `PORT` | no | `3000` (image) | Port the standalone Next.js server listens on. | Set in the Dockerfile. |
| `HOSTNAME` | no | `0.0.0.0` (image) | Bind address for the standalone server. | Set in the Dockerfile. |

`NEXT_RUNTIME` is also read (`src/instrumentation.ts`, to skip client/edge-only setup) but is set
by Next.js itself, not a user-facing configuration variable.

## Minimal `.env`

```ini
APP_URL=https://tortuga.example.com
SESSION_SECRET=change-me-to-a-random-32-char-string
AUTH_SECRET=change-me-to-another-random-32-char-string

# Auth (session mode bootstrap; omit both to create the first admin some other way)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-please

# Tautulli
TAUTULLI_URL=http://tautulli:8181
TAUTULLI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# TMDB (optional, enables artwork/ratings)
TMDB_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email (pick one provider; also set newsletter.email.provider in tortuga.yml)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

## Related

- [Configuration overview](./index.md)
- [tortuga.yml reference](./tortuga-yml.md)
- [Email providers](../guide/email-providers.md)
