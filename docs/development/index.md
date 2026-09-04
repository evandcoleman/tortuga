# Development

Local setup, commands, and workflows for working on Tortuga itself.

## Clone and install

```bash
git clone https://github.com/evandcoleman/tortuga.git
cd tortuga
pnpm install
```

Requires Node `>=22` and pnpm `9.12.0` (see `engines`/`packageManager` in
`package.json`).

## Configuration for `pnpm dev`

Tortuga validates its environment with Zod at startup
(`EnvSchema` in `src/kernel/config/schema.ts`) — the process fails fast if a
required var is missing or malformed. At minimum:

```bash
export APP_URL="http://localhost:3000"
export SESSION_SECRET="change-me-to-a-random-32-char-string"  # 32+ chars
export AUTH_SECRET="change-me-to-another-random-32-char-string"  # required for session-mode login
```

A **`tortuga.yml`** is required — `loadYamlConfig()`
(`src/kernel/config/load.ts`) throws `tortuga.yml not found at ...; required
for v1` if the file at `CONFIG_PATH` (default `/config/tortuga.yml`, override
with the `CONFIG_PATH` env var for local dev) doesn't exist. Copy
`tortuga.example.yml` and point `CONFIG_PATH` at it, or create one under a
local `config/` directory:

```bash
mkdir -p config
cp tortuga.example.yml config/tortuga.yml
export CONFIG_PATH="$(pwd)/config/tortuga.yml"
```

`newsletter.from.email`/`from.name` are required by the YAML schema even in
dev; everything else in the newsletter section has a default. See the full
[environment variable reference](../configuration/environment.md) and
[tortuga.yml reference](../configuration/tortuga-yml.md) for every field.

```bash
pnpm dev
```

## Database

`DATABASE_URL` defaults to `file:/config/tortuga.db`; for local dev, point it
at a path inside your working copy, e.g. `file:./config/tortuga.db`. The
SQLite file is created automatically on first boot if it doesn't exist, and
`applyMigrations()` (`src/kernel/db/migrate.ts`) runs every migration under
`drizzle/` automatically on every startup — there is no separate "run
migrations" step to remember.

## Scripts

All scripts are defined in `package.json`:

| Script | Command | Purpose |
|---|---|---|
| `pnpm dev` | `next dev` | Local dev server with hot reload |
| `pnpm build` | `next build` | Production build (standalone output) |
| `pnpm start` | `next start` | Run a production build (needed by e2e tests) |
| `pnpm lint` | `eslint` | Lint with `eslint-config-next` (core web vitals + TypeScript) |
| `pnpm test` | `vitest run --passWithNoTests` | Run the unit/integration test suite once |
| `pnpm test:watch` | `vitest` | Run tests in watch mode |
| `pnpm test:coverage` | `vitest run --coverage` | Run tests with V8 coverage |
| `pnpm e2e` | `playwright test` | Run the Playwright end-to-end suite |
| `pnpm e2e:install` | `playwright install chromium` | Install the Playwright browser binary |
| `pnpm docs:dev` | `pnpm --dir docs dev` | Preview this docs site locally |
| `pnpm docs:build` | `pnpm --dir docs build` | Build the static docs site |
| `pnpm docs:preview` | `pnpm --dir docs preview` | Preview the built docs site |

## Tests

Unit and integration tests live alongside the code they test, as
`*.test.ts`/`*.test.tsx` files under `src/**` (configured in
`vitest.config.ts`, `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`).
Test environment is `node` (not jsdom/happy-dom by default), with a shared
setup file at `src/test/setup.ts`. Run:

```bash
pnpm test
```

### End-to-end (Playwright)

`e2e/*.spec.ts` covers a small number of full-stack flows (currently: the
login screen renders, and `/settings` redirects to login when unauthenticated
— most admin flows are exercised by unit tests instead). Playwright's
`webServer` config (`playwright.config.ts`) runs `pnpm start` against
`http://localhost:3000` automatically, so **you need a production build
first**:

```bash
pnpm build
pnpm e2e:install   # first time only
pnpm e2e
```

The e2e suite expects the same env/`tortuga.yml` setup as `pnpm dev` — set
`APP_URL`, `SESSION_SECRET`, `CONFIG_PATH`, etc. before running it, or export
them in the shell that runs `pnpm e2e`.

## Lint

```bash
pnpm lint
```

Uses `eslint-config-next`'s `core-web-vitals` and `typescript` rule sets
(`eslint.config.mjs`).

## Adding a migration

Drizzle schemas live in `src/kernel/db/schema.ts` and `src/modules/*/schema.ts`
(see `drizzle.config.ts`). After changing a schema file, generate the
migration rather than hand-writing SQL or journal entries:

```bash
pnpm dlx drizzle-kit generate
```

This writes a new numbered `.sql` file under `drizzle/` and updates
`drizzle/meta/_journal.json`. Commit both. Migrations apply automatically on
next boot (see [Database](#database) above) — there is no manual `migrate`
command to run in production.

## Docs site

This site is built with [VitePress](https://vitepress.dev), in its own
`docs/package.json` with a separate lockfile so its pinned Vite 5.x
dependency doesn't conflict with the Vite 8.x that the root's Vitest suite
needs. Preview changes locally:

```bash
pnpm docs:dev
```

Build the static site (what CI/GitHub Pages deploys):

```bash
pnpm docs:build
```

## Related

- [Architecture](./architecture.md)
- [Contributing](./contributing.md)
