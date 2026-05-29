# Deployment

Tortuga ships as a single Docker image and a SQLite database on a `/config`
volume. It is designed to run as a single replica (the in-process context cache
and cron scheduler assume `count=1`).

## Image

CI publishes to GHCR on every push to `main` and on `v*` tags
(`.github/workflows/release.yml`):

- `ghcr.io/evandcoleman/tortuga:latest` — latest `main`
- `ghcr.io/evandcoleman/tortuga:<version>` — semver tags
- `ghcr.io/evandcoleman/tortuga:sha-<sha>` — per-commit

The image (`Dockerfile`) is `node:22-alpine`, runs under `tini`, listens on
`3000` (`HOSTNAME=0.0.0.0`), uses Next.js standalone output, and bakes in these
defaults:

```
NODE_ENV=production
PORT=3000
CONFIG_PATH=/config/tortuga.yml
DATABASE_URL=file:/config/tortuga.db
```

It declares `VOLUME ["/config"]`. Drizzle migration files are copied in and
applied on startup.

## docker compose (local / single host)

See [`docker-compose.example.yml`](../docker-compose.example.yml). Copy it,
mount `./config:/config`, and supply secrets via a sibling `.env` using the
`${VAR}` substitution pattern already in the file:

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
# create .env with TAUTULLI_API_KEY, TMDB_API_KEY, RESEND_API_KEY, APP_URL,
# SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_MODE
docker compose up -d
```

## Standalone docker run

```bash
docker run -d --name tortuga \
  -p 3000:3000 \
  -v "$PWD/config:/config" \
  -e TAUTULLI_URL=http://tautulli:8181 \
  -e TAUTULLI_API_KEY=... \
  -e TMDB_API_KEY=... \
  -e RESEND_API_KEY=... \
  -e APP_URL=https://tortuga.example.com \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD=change-me \
  ghcr.io/evandcoleman/tortuga:latest
```

`/config` only needs to be writable; `tortuga.db` is created on first boot, and
`tortuga.yml` is optional (UI overrides are stored in the DB).

## Nomad (Olympus homelab)

Tortuga fits the standard Olympus Nomad pattern. Key points specific to this
service:

- **Single instance.** Run `count = 1`. The app caches its `AppContext`
  (config, DB handle, cron scheduler) in-process and reloads it in-place on
  config changes; a second replica would hold a stale cache and double-fire the
  scheduler.
- **Persistent volume.** Mount a CSI volume at `/config` so `tortuga.db`
  survives restarts and reschedules. This is the only stateful path.
- **Image versioning.** Track the deployed tag in the cluster's
  `versions.json` and bump it to roll out a new image; CI auto-deploy keys off
  that file (per the Olympus deploy contract). Use the `olympus-deploy` skill
  for the actual deploy/redeploy/restart.
- **Auth.** Front Tortuga with Authelia ForwardAuth and set `AUTH_MODE=forward`
  + `AUTH_FORWARD_HEADER=Remote-User` (Authelia's default). Tortuga's
  middleware then trusts the proxied identity and you skip the built-in login.
- **Scheduled sends.** The built-in croner scheduler handles the weekly send,
  so no external cron is required. If you prefer an external trigger (Nomad
  periodic batch job hitting the API), set `schedule_enabled: false` and POST
  `/api/digests/run` with `DIGEST_RUN_TOKEN` — see [API.md](API.md).

> The `/data` path is reserved for future use; v1 persists everything under
> `/config`.

## Secrets

Inject secrets via the environment (compose `.env`, Nomad template from Vault,
etc). Never bake secrets into the image or commit them. `SESSION_SECRET` must be
unique per deployment and 32+ characters (`openssl rand -base64 32`).

## Upgrades

Pull the new image tag and recreate the container. Migrations apply
automatically on the next startup against the existing `/config/tortuga.db`, so
back up that file before a major upgrade if you want a rollback point.
