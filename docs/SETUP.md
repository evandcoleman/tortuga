# Setup

Step-by-step first-run guide for Tortuga. For the env-var and config reference,
see the [README](../README.md) and [CONFIG.md](CONFIG.md).

## 1. Prerequisites

- A running Tautulli instance with an API key (Settings → Web Interface → API).
- A [TMDB](https://www.themoviedb.org/settings/api) v3 API key.
- An email provider account: [Resend](https://resend.com) (default) or
  [Mailgun](https://www.mailgun.com). See [EMAIL-PROVIDERS.md](EMAIL-PROVIDERS.md).
- Docker + docker compose (for the quickstart path).

## 2. Copy the config and compose files

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
```

`config/` is bind-mounted into the container at `/config`. It will also hold the
auto-created SQLite database `tortuga.db`.

## 3. Populate environment variables

The compose file reads from a `.env` in the same directory (variable
substitution like `${TAUTULLI_API_KEY}`). Create `.env`:

```bash
TAUTULLI_API_KEY=...
TMDB_API_KEY=...
RESEND_API_KEY=...           # or the Mailgun pair, see below
APP_URL=https://tortuga.example.com
SESSION_SECRET=$(openssl rand -base64 32)
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me-8-or-more
AUTH_MODE=session
```

Also set `TAUTULLI_URL` (in compose or `.env`) to a URL the container can reach
— from inside Docker that is usually the service name, e.g.
`http://tautulli:8181`, not `http://localhost:8181`.

For Mailgun, drop `RESEND_API_KEY` and instead set:

```bash
MAILGUN_API_KEY=...
MAILGUN_WEBHOOK_SIGNING_KEY=...
```

and set `newsletter.email.provider: mailgun` (plus `mailgun.domain`) in
`config/tortuga.yml`.

> Required vars are validated by Zod at startup. A missing or malformed value
> (e.g. a `SESSION_SECRET` shorter than 32 chars, or a non-URL `TAUTULLI_URL`)
> stops the process with a clear error in the logs.

## 4. Edit the YAML config

At minimum set `newsletter.from.email` to an address on your verified sending
domain, and pick the libraries to include. See [CONFIG.md](CONFIG.md) for every
field.

## 5. Start it

```bash
docker compose up -d
docker compose logs -f tortuga
```

On first boot Tortuga:

1. Applies Drizzle migrations to `/config/tortuga.db`.
2. Loads `tortuga.yml` (or the DB override, if one exists).
3. In `session` mode, creates the admin user from `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` **if the users table is empty**.
4. Registers the scheduler cron job.

## 6. Verify

- Health: `curl http://localhost:3000/api/healthz` — should return
  `{"status":"ok", ...}` with `db` and `tautulli` both `"ok"`. See
  [API.md](API.md#get-apihealthz) for the payload shape.
- Login: open `http://localhost:3000`, sign in with the admin credentials.
- Connections: in **Settings**, use **Test connections** to verify Tautulli,
  TMDB, and the email provider individually.
- Preview: **Newsletter → Preview → Generate fresh preview**, then **Send test
  to me** to confirm end-to-end delivery before sending for real.

## Troubleshooting FAQ

**Container exits immediately on startup.**
Almost always a failed env validation. Run `docker compose logs tortuga` and
look for a Zod error naming the offending variable. Common causes:
`SESSION_SECRET` under 32 chars, `TAUTULLI_URL`/`APP_URL` not a valid URL,
`ADMIN_PASSWORD` under 8 chars.

**`tautulli` reports `fail` in healthz / Test connections fails.**
Verify `TAUTULLI_URL` is reachable *from inside the container* (use the Docker
service name or LAN IP, not `localhost`) and that `TAUTULLI_API_KEY` is the API
key from Settings → Web Interface → API.

**TMDB enrichment empty or Test connections fails for TMDB.**
Confirm `TMDB_API_KEY` is a **v3** API key (not a v4 read token).

**Email provider test fails.**
For Resend: check `RESEND_API_KEY` and that `from.email`'s domain is verified.
For Mailgun: check `MAILGUN_API_KEY`, `MAILGUN_WEBHOOK_SIGNING_KEY`,
`mailgun.domain`, and that `region` matches your Mailgun account (`us` vs `eu`).
See [EMAIL-PROVIDERS.md](EMAIL-PROVIDERS.md).

**Can't log in / no admin user.**
The bootstrap only runs when the users table is empty. If you started once
without `ADMIN_EMAIL`/`ADMIN_PASSWORD`, set them and restart — the bootstrap
runs on the next start since no user exists yet. If a user already exists, the
variables are ignored by design.

**Login page never appears in `forward` mode.**
That's expected — `forward` mode has no built-in login. Requests must arrive
with the `AUTH_FORWARD_HEADER` (default `Remote-User`) set by your upstream
proxy, or they get a `401`.

**More log detail.**
Set `LOG_LEVEL=debug` (or `trace`) and restart to see verbose pino output.

**Migration / database errors.**
The migration files in `drizzle/` are applied automatically on startup; the
Docker build runs `drizzle-kit generate`. If startup fails on a migration,
inspect `docker compose logs tortuga`. Do not hand-edit `drizzle/meta/`.
