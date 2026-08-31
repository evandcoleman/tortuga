# Tortuga

Front-of-house for your Plex server. Sends a weekly digest of new content,
filtered and TMDB-enriched, via [Resend](https://resend.com) or
[Mailgun](https://www.mailgun.com). v1 ships newsletter-only; invites, recipient preferences, scheduled
announcements, and more are on the [roadmap](ROADMAP.md).

## Quickstart (docker compose)

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
# edit config/tortuga.yml and create a .env (see "Required env" below)
docker compose up -d
```

Open `http://localhost:3000`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
go to **Newsletter → Preview**, and click "Generate fresh preview". When the
preview looks right, use **Send test to me** to confirm delivery, then **Send
now** (or wait for the schedule) to send for real.

For a step-by-step walkthrough see [docs/SETUP.md](docs/SETUP.md).

## Required env

These are validated by Zod (`EnvSchema` in `src/kernel/config/schema.ts`) at
startup; the process fails fast if any are missing or malformed.

| Var | Description |
|---|---|
| `TAUTULLI_URL` | URL to your Tautulli instance (must be a valid URL) |
| `TAUTULLI_API_KEY` | Tautulli API key (Settings → Web Interface → API) |
| `TMDB_API_KEY` | TMDB v3 API key |
| `APP_URL` | Public URL used in email links and unsubscribe tokens (must be a valid URL) |
| `SESSION_SECRET` | Random string, **32+ characters**. Generate with `openssl rand -base64 32` |
| `RESEND_API_KEY` | Required when the email provider is `resend` (the default) |

Mailgun deployments require `MAILGUN_API_KEY` and `MAILGUN_WEBHOOK_SIGNING_KEY`
instead of `RESEND_API_KEY` — see [Email providers](#email-providers).

> [!WARNING]
> `SESSION_SECRET` signs auth sessions and unsubscribe tokens. Use a unique,
> random value per deployment and never reuse a development secret in
> production.

## Optional env

| Var | Default | Description |
|---|---|---|
| `AUTH_MODE` | `session` | `session` (built-in login) or `forward` (trust an upstream proxy header) |
| `AUTH_FORWARD_HEADER` | `Remote-User` | Header read to identify the user when `AUTH_MODE=forward` |
| `ADMIN_EMAIL` | — | Bootstraps the first admin user on startup (session mode only) |
| `ADMIN_PASSWORD` | — | Password for the bootstrap admin, **8+ characters** |
| `DIGEST_RUN_TOKEN` | — | Bearer token (**16+ chars**) to trigger `POST /api/digests/run` from external cron |
| `RESEND_WEBHOOK_SECRET` | — | Resend webhook signing secret; required to accept Resend delivery events |
| `MAILGUN_API_KEY` | — | Mailgun private API key; required when `provider=mailgun` |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | — | Mailgun HTTP webhook signing key; required when `provider=mailgun` |
| `ANTHROPIC_API_KEY` | — | Required when AI commentary is enabled with `provider=anthropic` |
| `OPENAI_API_KEY` | — | Required when AI commentary is enabled with `provider=openai` |
| `DATABASE_URL` | `file:/config/tortuga.db` | SQLite database location |
| `CONFIG_PATH` | `/config/tortuga.yml` | Path to the YAML config file |
| `MAINTAINERR_URL` | — | URL to your Maintainerr instance; enables the "Leaving soon" digest section |
| `LOG_LEVEL` | `info` | pino log level (`trace`/`debug`/`info`/`warn`/`error`) |

## Authentication

Tortuga supports two auth modes, selected by `AUTH_MODE`:

- **`session`** (default) — built-in email/password login backed by NextAuth
  (Credentials provider) and Argon2id password hashing. Use this when Tortuga
  is exposed directly. On startup, if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are
  set and the `users` table is empty, a single admin user is created
  automatically (`bootstrapAdminUser`). This is a one-time bootstrap: once any
  user exists, the variables are ignored.
- **`forward`** — trust an upstream identity-aware proxy (e.g. Authelia,
  oauth2-proxy). The middleware requires the `AUTH_FORWARD_HEADER` header
  (default `Remote-User`) to be present on every protected request; no built-in
  login is used. Put Tortuga behind a proxy that injects this header.

Public routes (no auth in either mode): `/login`, `/api/healthz`,
`/api/unsubscribe`, `/api/webhooks/resend`, `/api/webhooks/mailgun`,
`/api/auth/*`.

Decision: behind Authelia / SSO → `forward`. Self-contained / direct exposure →
`session`. See [docs/SETUP.md](docs/SETUP.md) for details.

## YAML configuration

Newsletter behavior lives in `tortuga.yml` (mounted at `CONFIG_PATH`). It is
validated against `NewsletterConfigSchema`. Settings edited in the admin UI are
persisted as a database override that takes precedence over the YAML file.

```yaml
newsletter:
  schedule: "0 9 * * SUN"    # cron, in `timezone`
  schedule_enabled: true     # false pauses automatic sends (manual/API still work)
  timezone: "America/New_York"
  lookback_days: 7
  email:
    provider: resend          # resend | mailgun
  from:
    email: "orpheus@yourdomain.com"
    name: "Orpheus"
  reply_to: "you@example.com"
  include_libraries: ["Movies", "TV Shows"]
  filters:
    min_tmdb_rating: 6.0
    dedupe_episodes_into_seasons: true
    max_items_per_section: 12
    exclude_genres: []
```

Full field-by-field reference, types, defaults, and validation rules:
[docs/CONFIG.md](docs/CONFIG.md).

## Email providers

Pick one provider via `newsletter.email.provider`. Both require a verified
sending domain for the `from.email` address (SPF/DKIM/DMARC).

- **Resend** — set `RESEND_API_KEY`. To record delivery/bounce/complaint
  events, also set `RESEND_WEBHOOK_SECRET` and point a Resend webhook at
  `POST /api/webhooks/resend`.
- **Mailgun** — set `provider: mailgun` plus `mailgun.domain` (and optional
  `region: us|eu`) in YAML, and `MAILGUN_API_KEY` +
  `MAILGUN_WEBHOOK_SIGNING_KEY` in the env. Point a Mailgun webhook at
  `POST /api/webhooks/mailgun`.

> [!WARNING]
> The webhook signing secret (`RESEND_WEBHOOK_SECRET` /
> `MAILGUN_WEBHOOK_SIGNING_KEY`) is **not** your API key. It is a separate value
> from each provider's webhook settings. Webhook requests with a missing or
> invalid signature are rejected with `401`.

Full setup, domain verification, and signature details:
[docs/EMAIL-PROVIDERS.md](docs/EMAIL-PROVIDERS.md).

## Triggering a digest

The digest runs automatically on `schedule` (when `schedule_enabled`), via the
**Send now** button in the admin UI, or via the API:

```bash
curl -X POST "$APP_URL/api/digests/run" \
  -H "Authorization: Bearer $DIGEST_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

`{"dry_run": true}` renders the digest without sending — useful for testing an
external cron job. Full API reference: [docs/API.md](docs/API.md).

## Data directory

The container mounts `/config`, which holds:

- `tortuga.db` — SQLite database (Tautulli/recipient cache, sends, send events,
  users, config overrides). Migrations from `drizzle/` are applied
  automatically on startup.
- `tortuga.yml` — optional YAML config (UI overrides supersede it).

## Deployment

- Local: `docker compose up -d` (see [Quickstart](#quickstart-docker-compose)).
- Standalone image: `ghcr.io/evandcoleman/tortuga:latest`
  (`node:22-alpine`, tini entrypoint, listens on `3000`, `/config` volume).
- Nomad / Olympus: see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — first-run setup + troubleshooting FAQ
- [docs/CONFIG.md](docs/CONFIG.md) — YAML config reference
- [docs/EMAIL-PROVIDERS.md](docs/EMAIL-PROVIDERS.md) — Resend & Mailgun setup
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Docker, compose, Nomad
- [docs/API.md](docs/API.md) — digest, webhook, and healthz endpoints

## Architecture

See [docs/superpowers/specs/2026-05-12-tortuga-design.md](docs/superpowers/specs/2026-05-12-tortuga-design.md).
