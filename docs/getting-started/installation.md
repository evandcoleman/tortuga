# Installation

Tortuga ships as a single Docker image (`ghcr.io/evandcoleman/tortuga`) containing the
Next.js app, its Drizzle migrations, and the SQLite CLI. Everything it persists — the
SQLite database and `tortuga.yml` — lives under one `/config` volume.

::: code-group

```bash [Docker Compose]
cp docker-compose.example.yml docker-compose.yml
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
# create a .env — see First run
docker compose up -d
docker compose logs -f tortuga
```

```bash [docker run]
mkdir -p config && cp tortuga.example.yml config/tortuga.yml
docker run -d --name tortuga \
  -p 3000:3000 \
  -v "$PWD/config:/config" \
  -e TAUTULLI_URL=http://tautulli:8181 \
  -e TAUTULLI_API_KEY=... \
  -e TMDB_API_KEY=... \
  -e RESEND_API_KEY=... \
  -e APP_URL=https://tortuga.example.com \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD=change-me-to-a-random-string \
  ghcr.io/evandcoleman/tortuga:latest
```

```bash [From source]
git clone https://github.com/evandcoleman/tortuga.git
cd tortuga
pnpm install
cp tortuga.example.yml tortuga.yml
# CONFIG_PATH and DATABASE_URL default to /config/... (container paths); running
# from source needs them pointed at your working copy:
export CONFIG_PATH="$(pwd)/tortuga.yml"
export DATABASE_URL="file:./tortuga.db"
# set other required env vars (see First run: APP_URL, SESSION_SECRET, AUTH_SECRET, ...), then:
pnpm build
pnpm start
```

:::

Docker Compose is the recommended path: `docker-compose.example.yml` in the repo root is
a working starting point. Both container methods pull the prebuilt image; only the
from-source path builds locally.

## Image tags

- `ghcr.io/evandcoleman/tortuga:latest` — latest build of `main`.
- `ghcr.io/evandcoleman/tortuga:<version>` — semver release tags.
- `ghcr.io/evandcoleman/tortuga:sha-<commit>` — a specific commit.

See [Upgrading](/operations/upgrading) for how tags map to releases.

## Next

Continue to [First run](/getting-started/first-run) to set the required environment
variables, write `tortuga.yml`, and verify the instance is healthy.

## Related

- [First run](/getting-started/first-run)
- [Deployment](/operations/deployment)
