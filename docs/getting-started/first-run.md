# First run

Step-by-step walkthrough for getting a fresh Tortuga instance running, verified, and
sending mail. Assumes you've already picked an [installation](/getting-started/installation)
method.

## 1. Prerequisites

- A running Tautulli instance with an API key (**Settings → Web Interface → API**).
- A [TMDB](https://www.themoviedb.org/settings/api) v3 API key.
- An email provider account: [Resend](https://resend.com) (default) or
  [Mailgun](https://www.mailgun.com). See [Email providers](/guide/email-providers).
- Docker + Docker Compose (for the quickstart path).

## 2. Copy the config and compose files

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
```

`config/` is bind-mounted into the container at `/config`. It also holds the
auto-created SQLite database, `tortuga.db`.

## 3. Populate environment variables

The compose file reads from a `.env` in the same directory (variable substitution like
`${TAUTULLI_API_KEY}`). Create `.env`:

```bash
TAUTULLI_API_KEY=...
TMDB_API_KEY=...
RESEND_API_KEY=...           # or the Mailgun pair, see below
APP_URL=https://tortuga.example.com
SESSION_SECRET=change-me-to-a-random-32-char-string
AUTH_SECRET=change-me-to-another-random-32-char-string
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me-8-or-more
AUTH_MODE=session
```

`AUTH_SECRET` is required whenever `AUTH_MODE=session` (the default) — Auth.js uses it to
sign and encrypt session cookies, and login fails without it. Generate one with
`openssl rand -base64 32`. It is distinct from `SESSION_SECRET`; see
[Environment variables](/configuration/environment) for what each one actually does.

Also set `TAUTULLI_URL` (in compose or `.env`) to a URL the container can reach — from
inside Docker that's usually a service name, e.g. `http://tautulli:8181`, not
`http://localhost:8181`.

For Mailgun, drop `RESEND_API_KEY` and instead uncomment the `MAILGUN_API_KEY` /
`MAILGUN_WEBHOOK_SIGNING_KEY` lines already present (commented out) in
`docker-compose.example.yml`, then set their values in `.env`:

```bash
MAILGUN_API_KEY=...
MAILGUN_WEBHOOK_SIGNING_KEY=...
```

and set `newsletter.email.provider: mailgun` (plus `mailgun.domain`) in
`config/tortuga.yml`.

::: tip
Required vars are validated with Zod at startup. A missing or malformed value (e.g. a
`SESSION_SECRET` shorter than 32 characters, or a non-URL `APP_URL`) stops the process
with an `Invalid environment: ...` error naming every offending field — see
[Troubleshooting](/operations/troubleshooting).
:::

See [Environment variables](/configuration/environment) for the full list.

## 4. Edit the YAML config

At minimum, set `newsletter.from.email` to an address on your verified sending domain and
pick which libraries to include. A minimal `tortuga.yml`:

```yaml
newsletter:
  schedule: "0 9 * * SUN"
  timezone: "America/New_York"
  lookback_days: 7
  from:
    email: "you@example.com"
    name: "Your Server"
  include_libraries:
    - "Movies"
    - "TV Shows"
```

See [tortuga.yml reference](/configuration/tortuga-yml) for every field, including
optional sections (commentary, extras, leaving-soon, portal).

## 5. Start it

```bash
docker compose up -d
docker compose logs -f tortuga
```

On first boot, Tortuga:

1. Applies Drizzle migrations to `/config/tortuga.db`.
2. Loads `tortuga.yml` (or a saved DB override, if one already exists).
3. In `session` auth mode, creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   **if the users table is empty**.
4. Registers the newsletter scheduler's cron job (unless `schedule_enabled: false`).

## 6. Verify

- **Health:** `curl http://localhost:3000/api/healthz` — expect `{"status":"ok", ...}`
  with `db` and `tautulli` both `"ok"`. See the
  [`/api/healthz` reference](/reference/api#get-apihealthz) for the full payload shape.
- **Login:** open `http://localhost:3000` and sign in with the admin credentials.
- **Connections:** on **Settings → Services**, use each service's **Test** button to verify
  Tautulli and TMDB; on **Settings → Email**, use **Test** to verify the email provider.
- **Preview:** go to **Newsletter → Preview → Generate fresh preview**, then **Send test
  to me** to confirm end-to-end delivery before letting the schedule fire for real.

## Related

- [Installation](/getting-started/installation)
- [Configuration overview](/configuration/)
- [Newsletter guide](/guide/newsletter)
- [Troubleshooting](/operations/troubleshooting)
