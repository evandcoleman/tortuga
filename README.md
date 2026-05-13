# Tortuga

Front-of-house for your Plex server. Sends a weekly digest of new content,
filtered and TMDB-enriched, via [Resend](https://resend.com). v1 ships
newsletter-only; broadcasts, invites, and user lifecycle are on the roadmap.

## Quickstart (docker compose)

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
# edit config/tortuga.yml and your .env
docker compose up -d
```

Open `http://localhost:3000`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
go to **Newsletter → Preview**, click "Generate fresh preview".

## Required env

| Var | Description |
|---|---|
| `TAUTULLI_URL` | URL to your Tautulli instance |
| `TAUTULLI_API_KEY` | Tautulli API key (Settings → Web Interface) |
| `TMDB_API_KEY` | TMDB v3 API key |
| `RESEND_API_KEY` | Resend API key |
| `APP_URL` | Public URL used in email links |
| `SESSION_SECRET` | Random 32+ char string |

## Optional env

| Var | Default | Description |
|---|---|---|
| `AUTH_MODE` | `session` | `session` (built-in login) or `forward` (trust upstream header) |
| `AUTH_FORWARD_HEADER` | `Remote-User` | Header to read when `AUTH_MODE=forward` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Bootstraps the first admin user when `AUTH_MODE=session` |
| `DIGEST_RUN_TOKEN` | — | Bearer token to trigger `POST /api/digests/run` from external cron |
| `RESEND_WEBHOOK_SECRET` | — | Required for Resend webhook delivery events |
| `LOG_LEVEL` | `info` | pino log level |

## Deliverability

Resend requires domain verification for the `from:` address in
`tortuga.yml` (SPF/DKIM/DMARC). Set this up in Resend before your first send.

## Triggering manually

```bash
curl -X POST $APP_URL/api/digests/run \
  -H "Authorization: Bearer $DIGEST_RUN_TOKEN"
```

Body `{"dry_run": true}` renders without sending.

## Architecture

See [docs/superpowers/specs/2026-05-12-tortuga-design.md](docs/superpowers/specs/2026-05-12-tortuga-design.md).
