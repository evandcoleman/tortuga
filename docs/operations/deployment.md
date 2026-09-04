# Deployment

Tortuga ships as a single Docker image with a SQLite database on a `/config` volume. It
runs as a single Node.js process and is designed for exactly one replica.

## Image

CI publishes to GHCR on every push to `main` and on `v*` tags
(`.github/workflows/release.yml`):

- `ghcr.io/evandcoleman/tortuga:latest` — latest `main`.
- `ghcr.io/evandcoleman/tortuga:<version>` — semver tags.
- `ghcr.io/evandcoleman/tortuga:sha-<sha>` — per-commit.

The image (`node:22-alpine`) runs under `tini`, listens on `3000`
(`HOSTNAME=0.0.0.0`), uses Next.js standalone output, and bakes in these defaults:

```
NODE_ENV=production
PORT=3000
CONFIG_PATH=/config/tortuga.yml
DATABASE_URL=file:/config/tortuga.db
```

It declares `VOLUME ["/config"]`. Drizzle migration files and the `sqlite3` CLI are
included in the runtime image.

## Ports, volumes, environment

- **Port:** the app listens on `3000` inside the container.
- **Volume:** mount a host path or named volume at `/config`. This is the only stateful
  path — it holds `tortuga.db` (created on first boot) and `tortuga.yml`.
- **Environment:** at minimum `APP_URL`, `SESSION_SECRET`, `AUTH_SECRET` (required when
  `AUTH_MODE=session`, the default), and your Tautulli/TMDB/email provider credentials.
  See [Environment variables](/configuration/environment) for the full list and defaults.

## Docker Compose (local / single host)

See [`docker-compose.example.yml`](https://github.com/evandcoleman/tortuga/blob/main/docker-compose.example.yml)
in the repo root. Copy it, mount `./config:/config`, and supply secrets via a sibling
`.env` using the `${VAR}` substitution already in the file:

```bash
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
# create .env with TAUTULLI_API_KEY, TMDB_API_KEY, RESEND_API_KEY, APP_URL,
# SESSION_SECRET, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_MODE
docker compose up -d
```

See [Installation](/getting-started/installation) for the `docker run` equivalent.

## Reverse proxy and `APP_URL`

Tortuga trusts `APP_URL` to build absolute links (unsubscribe URLs, preview links, portal
links) and NextAuth sets `trustHost: true`, so it will accept whatever `Host` header your
proxy forwards. Point a reverse proxy (Traefik, Caddy, nginx, etc.) at container port
`3000` with TLS terminated in front of it, and set `APP_URL` to the public HTTPS URL.

## Forward auth (`AUTH_MODE=forward`)

By default Tortuga authenticates with its own login page (`AUTH_MODE=session`, the
default). If you already run a forward-auth proxy (e.g. Authelia) in front of it, set:

```
AUTH_MODE=forward
AUTH_FORWARD_HEADER=Remote-User   # default; change if your proxy uses a different header
```

In `forward` mode, every request to an admin route must carry the configured header —
Tortuga treats its mere presence as proof of an authenticated upstream identity and skips
its own login. It does not verify the header's value against anything.

::: warning
Your reverse proxy **must strip any client-supplied copy of `AUTH_FORWARD_HEADER`**
before setting its own trusted value, on every path — not just the login flow. Tortuga
does not do this for you on admin routes: if a proxy misconfiguration lets a client set
`Remote-User` directly, that client can authenticate as anyone. (Tortuga's middleware does
strip inbound copies of this header on the [portal](/guide/portal) domain, since that host
is public by design — but that protection doesn't extend to the admin host.)
:::

## Portal host routing

If you enable the [user portal](/guide/portal), it's served from a second hostname
(`portal.domain` in `tortuga.yml`) pointed at the same container. Tortuga's middleware
routes requests by the incoming `Host` header: requests to the portal domain are rewritten
to the public portal pages and bypass admin auth entirely; every other host goes through
normal admin auth. Point both hostnames at the same upstream in your reverse proxy — no
separate container or port is needed. If you run forward auth in front of Tortuga, bypass
it for the portal domain there too, since the portal is meant to be public.

## Why only one instance

Run `count = 1` (or your platform's equivalent). Tortuga caches its config, database
handle, and cron scheduler in a single in-process object per Node.js process (see
`getAppContext()`), and the newsletter module registers exactly one cron job per process
on boot. A second replica would hold its own independent cache and its own cron job,
double-firing scheduled sends and letting config-override writes disagree between
replicas.

## Logs

Tortuga logs to stdout with `pino`. Read them with `docker logs -f tortuga` (or
`docker compose logs -f tortuga`). Set `LOG_LEVEL=debug` or `LOG_LEVEL=trace` and restart
for verbose output; the default is `info`.

## Example: Nomad

Tortuga fits the standard Nomad + Traefik + Vault pattern with no special handling beyond
the points above:

- Run `count = 1`.
- Mount a persistent volume at `/config`.
- Inject secrets from Vault via `template` blocks into environment variables.
- Front it with Traefik and, if used, forward-auth middleware bypassed for the portal
  domain.

## Secrets

Inject secrets via the environment (compose `.env`, a secrets manager, etc.). Never bake
secrets into the image or commit them. `SESSION_SECRET` and `AUTH_SECRET` must each be
unique per deployment and 32+ characters — generate them with `openssl rand -base64 32`.

## Related

- [Installation](/getting-started/installation)
- [Upgrading](/operations/upgrading)
- [Environment variables](/configuration/environment)
- [Troubleshooting](/operations/troubleshooting)
