# Tortuga

Front-of-house for your Plex server: a weekly digest of new content, one-off
announcements, Plex invites with a welcome email, a public portal for your
users, and an admin dashboard to run it all — self-hosted, backed by
[Tautulli](https://tautulli.com) and [TMDB](https://www.themoviedb.org), sent
via [Resend](https://resend.com) or [Mailgun](https://www.mailgun.com).

## Features

- **Newsletter** — a scheduled digest of recently-added content, TMDB-enriched
  and filtered, with an optional AI-generated intro, a "leaving soon" section
  (via [Maintainerr](https://github.com/jorenn92/Maintainerr)), and a
  permanent hosted web page per issue.
- **Announcements** — one-off messages to some or all recipients, with a
  reusable template library and scheduled sends.
- **Invites** — send Plex library invites and a templated welcome email
  without leaving Tortuga.
- **Recipients** — synced from Tautulli, with per-recipient preferences
  (category opt-out, library selection), automatic suppression on hard
  bounces/complaints, and self-service resubscribe.
- **Portal** — a small set of public pages (getting started, rules, report an
  issue, custom pages) served on your own domain.
- **Alerts** — an admin dashboard and email digest for scheduler failures,
  delivery problems, and bounce/complaint spikes.

Full documentation: **[evandcoleman.github.io/tortuga](https://evandcoleman.github.io/tortuga/)**

## Quick start (Docker Compose)

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
# edit config/tortuga.yml, then create a .env with the vars below
docker compose up -d
```

Minimum required `.env`:

```bash
TAUTULLI_API_KEY=your-tautulli-api-key
TMDB_API_KEY=your-tmdb-v3-api-key
RESEND_API_KEY=re_xxxxxxxx
APP_URL=https://tortuga.yourdomain.com
SESSION_SECRET=change-me-to-a-random-32-char-string
AUTH_SECRET=change-me-to-another-random-32-char-string
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me
```

Open Tortuga, sign in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`, go to
**Newsletter → Preview**, and generate a preview. Full walkthrough:
[Getting started](https://evandcoleman.github.io/tortuga/getting-started/).

## Documentation

- [Installation](https://evandcoleman.github.io/tortuga/getting-started/installation) — Docker Compose, `docker run`, from source
- [First run](https://evandcoleman.github.io/tortuga/getting-started/first-run) — env, `tortuga.yml`, first send
- [Configuration reference](https://evandcoleman.github.io/tortuga/configuration/) — env vars, `tortuga.yml`, portal
- [User guide](https://evandcoleman.github.io/tortuga/guide/newsletter) — newsletter, announcements, recipients, invites, portal, alerts
- [API reference](https://evandcoleman.github.io/tortuga/reference/api) — HTTP endpoints, auth, payloads
- [Deployment & operations](https://evandcoleman.github.io/tortuga/operations/deployment) — Docker, upgrading, backups, troubleshooting

## Development

```bash
pnpm install
pnpm dev
```

See [Development](https://evandcoleman.github.io/tortuga/development/) for
environment setup, tests, and the release process.

## Roadmap

Planned and shipped feature work: [ROADMAP.md](ROADMAP.md).

## License

MIT. See [LICENSE](LICENSE).
