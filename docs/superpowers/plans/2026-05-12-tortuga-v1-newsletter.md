# Tortuga v1 — Newsletter Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Tortuga v1 — a self-hosted Next.js app that replaces Tautulli's newsletter with a TMDB-enriched, filtered weekly digest delivered via Resend. Single Docker container, SQLite-backed, modular kernel ready for future modules.

**Architecture:** Next.js 15 App Router (`output: 'standalone'`) on Node 22. Single container. SQLite (Drizzle) at `/config/tortuga.db`. Internal croner schedule + `POST /api/digests/run` for external triggers. `src/kernel/` (db, config, auth, scheduler, email, integrations, logging, events) shared; `src/modules/newsletter/` is the only v1 module. Auth.js v5 in `session` mode, or middleware reads upstream header in `forward` mode.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM + better-sqlite3, Auth.js v5, react-email, Resend SDK, croner, pino, zod, Vitest, Playwright, pnpm.

**Reference spec:** `docs/superpowers/specs/2026-05-12-tortuga-design.md`.

---

## Phase 1 — Project scaffold

### Task 1: Initialize Next.js project

**Files:** `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `.editorconfig`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Scaffold via create-next-app**

Run inside the existing repo root (it already has `.git/` and `docs/`):
```bash
pnpm dlx create-next-app@latest . --typescript --eslint --app --src-dir --import-alias '@/*' --use-pnpm --tailwind --no-turbopack
```

- [ ] **Step 2: Pin Next.js + Node version**

Edit `package.json`:
```json
{
  "engines": { "node": ">=22.0.0" },
  "packageManager": "pnpm@9.12.0"
}
```

Edit `next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
```

- [ ] **Step 3: Add `.editorconfig` and tidy `.gitignore`**

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

Append to `.gitignore`:
```
# tortuga
/config/*.db
/config/*.db-*
.env*.local
playwright-report/
test-results/
```

- [ ] **Step 4: Verify dev server starts**

```bash
pnpm dev
```
Expected: Next.js boots, `http://localhost:3000` renders the default home page. Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js 15 app with typescript + tailwind"
```

---

### Task 2: Install core runtime dependencies

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add drizzle-orm better-sqlite3 zod pino pino-pretty croner \
  react-email @react-email/components @react-email/render \
  resend next-auth@beta @auth/drizzle-adapter argon2 \
  yaml @paralleldrive/cuid2
```

- [ ] **Step 2: Install dev deps**

```bash
pnpm add -D drizzle-kit @types/better-sqlite3 \
  vitest @vitest/coverage-v8 happy-dom \
  @playwright/test \
  tsx
```

- [ ] **Step 3: Verify install + commit**

```bash
pnpm install
git add package.json pnpm-lock.yaml
git commit -m "chore: add core runtime and dev dependencies"
```

---

### Task 3: Configure Vitest

**Files:** `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/app/**'],
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
```

- [ ] **Step 3: Add test scripts to `package.json` scripts block**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Smoke check + commit**

```bash
pnpm test
git add -A
git commit -m "chore: configure vitest"
```
Expected: "No test files found" (no failures).

---

## Phase 2 — Kernel foundation

### Task 4: Logging (pino)

**Files:** `src/kernel/logging/logger.ts`, `src/kernel/logging/logger.test.ts`

- [ ] **Step 1: Write failing test**

`src/kernel/logging/logger.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createLogger } from './logger';

describe('createLogger', () => {
  it('returns a logger with info/warn/error/debug methods', () => {
    const log = createLogger('test');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('inherits the module field via child loggers', () => {
    const log = createLogger('mymod');
    const child = log.child({ digest_id: 'abc' });
    expect(child.bindings()).toMatchObject({ module: 'mymod', digest_id: 'abc' });
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
pnpm test src/kernel/logging
```

- [ ] **Step 3: Implement**

`src/kernel/logging/logger.ts`:
```ts
import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const isDev = process.env.NODE_ENV !== 'production';

export const root = pino({
  level,
  transport: isDev && level !== 'silent'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export function createLogger(module: string) {
  return root.child({ module });
}

export type Logger = ReturnType<typeof createLogger>;
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test src/kernel/logging
git add -A
git commit -m "feat(kernel): structured logging with pino"
```

---

### Task 5: Config loader (env + tortuga.yml + zod)

**Files:** `src/kernel/config/schema.ts`, `src/kernel/config/load.ts`, `src/kernel/config/load.test.ts`, `tortuga.example.yml`

- [ ] **Step 1: Schemas**

`src/kernel/config/schema.ts`:
```ts
import { z } from 'zod';

export const EnvSchema = z.object({
  TAUTULLI_URL: z.string().url(),
  TAUTULLI_API_KEY: z.string().min(1),
  TMDB_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  AUTH_MODE: z.enum(['forward', 'session']).default('session'),
  AUTH_FORWARD_HEADER: z.string().default('Remote-User'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  DATABASE_URL: z.string().default('file:/config/tortuga.db'),
  DIGEST_RUN_TOKEN: z.string().min(16).optional(),
  LOG_LEVEL: z.string().default('info'),
  CONFIG_PATH: z.string().default('/config/tortuga.yml'),
});
export type Env = z.infer<typeof EnvSchema>;

export const NewsletterConfigSchema = z.object({
  schedule: z.string().default('0 9 * * SUN'),
  timezone: z.string().default('America/New_York'),
  lookback_days: z.number().int().positive().default(7),
  from: z.object({ email: z.string().email(), name: z.string() }),
  reply_to: z.string().email().optional(),
  include_libraries: z.array(z.string()).nullish(),
  filters: z.object({
    min_tmdb_rating: z.number().min(0).max(10).default(0),
    dedupe_episodes_into_seasons: z.boolean().default(true),
    max_items_per_section: z.number().int().positive().default(12),
    exclude_genres: z.array(z.string()).default([]),
  }).default({}),
  featured: z.object({ enabled: z.boolean().default(false) }).default({}),
});
export type NewsletterConfig = z.infer<typeof NewsletterConfigSchema>;

export const YamlConfigSchema = z.object({ newsletter: NewsletterConfigSchema });
export type YamlConfig = z.infer<typeof YamlConfigSchema>;
```

- [ ] **Step 2: Failing test**

`src/kernel/config/load.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, loadYamlConfig } from './load';

const baseEnv = {
  TAUTULLI_URL: 'http://localhost:8181',
  TAUTULLI_API_KEY: 'k',
  TMDB_API_KEY: 'k',
  RESEND_API_KEY: 'k',
  APP_URL: 'http://localhost:3000',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('loadEnv', () => {
  it('parses required env vars and applies defaults', () => {
    const env = loadEnv(baseEnv);
    expect(env.AUTH_MODE).toBe('session');
    expect(env.DATABASE_URL).toBe('file:/config/tortuga.db');
  });
  it('throws on missing required vars', () => {
    expect(() => loadEnv({})).toThrow(/TAUTULLI_URL/);
  });
});

describe('loadYamlConfig', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tortuga-cfg-')); });

  it('parses a valid file', () => {
    const path = join(dir, 'tortuga.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
`);
    const cfg = loadYamlConfig(path);
    expect(cfg.newsletter.schedule).toBe('0 9 * * SUN');
    expect(cfg.newsletter.from.email).toBe('from@example.com');
    rmSync(dir, { recursive: true });
  });

  it('throws when file missing', () => {
    expect(() => loadYamlConfig(join(dir, 'missing.yml'))).toThrow(/required/);
  });
});
```

- [ ] **Step 3: Implement**

`src/kernel/config/load.ts`:
```ts
import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { EnvSchema, YamlConfigSchema, type Env, type YamlConfig } from './schema';

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export function loadYamlConfig(path: string): YamlConfig {
  if (!existsSync(path)) {
    throw new Error(`tortuga.yml not found at ${path}; required for v1`);
  }
  const raw = parseYaml(readFileSync(path, 'utf8'));
  const parsed = YamlConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid tortuga.yml: ${issues}`);
  }
  return parsed.data;
}
```

- [ ] **Step 4: Write `tortuga.example.yml`**

```yaml
newsletter:
  schedule: "0 9 * * SUN"
  timezone: "America/New_York"
  lookback_days: 7
  from:
    email: "tortuga@example.com"
    name: "Olympus Plex"
  reply_to: "you@example.com"
  include_libraries:
    - "Movies"
    - "TV Shows"
  filters:
    min_tmdb_rating: 6.0
    dedupe_episodes_into_seasons: true
    max_items_per_section: 12
    exclude_genres: []
  featured:
    enabled: false
```

- [ ] **Step 5: Pass + commit**

```bash
pnpm test src/kernel/config
git add -A
git commit -m "feat(kernel): env + tortuga.yml config loader with zod schemas"
```

---

### Task 6: Drizzle client

**Files:** `src/kernel/db/client.ts`, `src/kernel/db/client.test.ts`, `drizzle.config.ts`

- [ ] **Step 1: `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: ['./src/kernel/db/schema.ts', './src/modules/*/schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: 'file:./config/tortuga.db' },
});
```

- [ ] **Step 2: Failing test**

`src/kernel/db/client.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  it('opens an in-memory db and runs a trivial query', () => {
    const db = createDb(':memory:');
    const rows = db.$client.prepare('select 1 as one').all();
    expect(rows).toEqual([{ one: 1 }]);
  });
});
```

- [ ] **Step 3: Implement**

`src/kernel/db/client.ts`:
```ts
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type Db = BetterSQLite3Database & { $client: Database.Database };

export function createDb(url: string): Db {
  const path = url.startsWith('file:') ? url.slice('file:'.length) : url;
  const sqlite = new Database(path);
  if (path !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
    sqlite.pragma('foreign_keys = ON');
  }
  const db = drizzle(sqlite) as Db;
  db.$client = sqlite;
  return db;
}
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test src/kernel/db
git add -A
git commit -m "feat(kernel): drizzle + better-sqlite3 client with WAL"
```

---

### Task 7: Auth tables in kernel schema

**Files:** `src/kernel/db/schema.ts`

- [ ] **Step 1: Define schema**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});
```

- [ ] **Step 2: Generate migration**

```bash
pnpm drizzle-kit generate --name init
```
Inspect resulting SQL under `drizzle/`. Should create `users` and `sessions`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(kernel): auth users + sessions tables"
```

---

### Task 8: Migration runner

**Files:** `src/kernel/db/migrate.ts`, `src/kernel/db/migrate.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/db/migrate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDb } from './client';
import { applyMigrations } from './migrate';

describe('applyMigrations', () => {
  it('creates the users table on a fresh db', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const cols = db.$client.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    expect(cols.map(c => c.name)).toContain('email');
  });

  it('is idempotent', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    expect(() => applyMigrations(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/db/migrate.ts`:
```ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

export function applyMigrations(db: Db) {
  migrate(db, { migrationsFolder: './drizzle' });
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/db
git add -A
git commit -m "feat(kernel): migration runner"
```

---

## Phase 3 — Integrations

### Task 9: Typed errors + retrying fetch

**Files:** `src/kernel/integrations/errors.ts`, `src/kernel/integrations/http.ts`, `src/kernel/integrations/http.test.ts`

- [ ] **Step 1: Errors**

`src/kernel/integrations/errors.ts`:
```ts
export class IntegrationError extends Error {
  constructor(
    public readonly source: 'tautulli' | 'tmdb' | 'resend',
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'IntegrationError';
  }
}
export class TautulliError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('tautulli', m, s, r, c); }
}
export class TmdbError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('tmdb', m, s, r, c); }
}
export class ResendError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('resend', m, s, r, c); }
}
```

- [ ] **Step 2: Failing test**

`src/kernel/integrations/http.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry } from './http';

describe('fetchWithRetry', () => {
  it('returns response on first success', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('http://x', {}, { fetcher, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 then succeeds', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('e', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('http://x', {}, { fetcher, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));
    const res = await fetchWithRetry('http://x', {}, { fetcher, retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Implement**

`src/kernel/integrations/http.ts`:
```ts
export interface RetryOpts {
  retries?: number;
  baseDelayMs?: number;
  fetcher?: typeof fetch;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOpts = {},
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 200;
  const f = opts.fetcher ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await f(url, init);
      if (res.status < 500 && res.status !== 0) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt === retries) break;
    await sleep(base * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test src/kernel/integrations
git add -A
git commit -m "feat(kernel): typed integration errors + retrying fetch"
```

---

### Task 10: Tautulli client

**Files:** `src/kernel/integrations/tautulli.ts`, `src/kernel/integrations/tautulli.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/integrations/tautulli.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createTautulliClient } from './tautulli';

const baseOpts = { url: 'http://t.local:8181', apiKey: 'k' };
const ok = (body: unknown) =>
  new Response(JSON.stringify({ response: { result: 'success', data: body } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });

describe('TautulliClient', () => {
  it('getUsers returns normalized users', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([
      { user_id: 1, friendly_name: 'A', email: 'a@x.io', username: 'a' },
      { user_id: 2, friendly_name: 'B', email: null, username: 'b' },
    ]));
    const client = createTautulliClient({ ...baseOpts, fetcher });
    const users = await client.getUsers();
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ email: 'a@x.io', name: 'A', plexUsername: 'a' });
    expect(users[1].email).toBeNull();
  });

  it('getRecentlyAdded filters by since', async () => {
    const now = Date.now();
    const items = [
      { added_at: String(Math.floor(now / 1000) - 60), guid: 'g1', title: 'T1', media_type: 'movie', library_name: 'Movies' },
      { added_at: String(Math.floor(now / 1000) - 86400 * 30), guid: 'g2', title: 'T2', media_type: 'movie', library_name: 'Movies' },
    ];
    const fetcher = vi.fn().mockResolvedValue(ok({ recently_added: items }));
    const client = createTautulliClient({ ...baseOpts, fetcher });
    const since = new Date(now - 7 * 86_400_000);
    const result = await client.getRecentlyAdded({ since, count: 200 });
    expect(result.map(i => i.guid)).toEqual(['g1']);
  });

  it('throws TautulliError on API error response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { result: 'error', message: 'bad key' } }), { status: 200 }),
    );
    const client = createTautulliClient({ ...baseOpts, fetcher });
    await expect(client.getUsers()).rejects.toThrow(/bad key/);
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/integrations/tautulli.ts`:
```ts
import { TautulliError } from './errors';
import { fetchWithRetry } from './http';

export interface TautulliOpts {
  url: string;
  apiKey: string;
  fetcher?: typeof fetch;
}
export interface TautulliUser {
  plexUserId: number;
  name: string;
  plexUsername: string | null;
  email: string | null;
}
export interface TautulliItem {
  guid: string;
  title: string;
  mediaType: string;
  libraryName: string;
  addedAt: Date;
  parentTitle?: string;
  grandparentTitle?: string;
  year?: number;
  summary?: string;
  thumb?: string;
  raw: Record<string, unknown>;
}

export function createTautulliClient(opts: TautulliOpts) {
  async function call<T>(cmd: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL('/api/v2', opts.url);
    url.searchParams.set('apikey', opts.apiKey);
    url.searchParams.set('cmd', cmd);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetchWithRetry(url.toString(), { method: 'GET' }, { fetcher: opts.fetcher });
    if (!res.ok) throw new TautulliError(`HTTP ${res.status}`, res.status, res.status >= 500);
    const json = (await res.json()) as { response: { result: string; message?: string; data: T } };
    if (json.response.result !== 'success') throw new TautulliError(json.response.message ?? 'unknown error');
    return json.response.data;
  }

  return {
    async getUsers(): Promise<TautulliUser[]> {
      const raw = await call<Array<{ user_id: number; friendly_name?: string; username?: string; email?: string | null }>>('get_users');
      return raw.map(r => ({
        plexUserId: r.user_id,
        name: r.friendly_name ?? r.username ?? 'Unknown',
        plexUsername: r.username ?? null,
        email: r.email ?? null,
      }));
    },

    async getRecentlyAdded(args: { since: Date; count?: number }): Promise<TautulliItem[]> {
      const data = await call<{ recently_added: Array<Record<string, unknown>> }>('get_recently_added', { count: args.count ?? 200 });
      const cutoff = Math.floor(args.since.getTime() / 1000);
      return (data.recently_added ?? [])
        .filter(it => Number(it.added_at) >= cutoff)
        .map(it => ({
          guid: String(it.guid ?? it.rating_key),
          title: String(it.title ?? ''),
          mediaType: String(it.media_type ?? ''),
          libraryName: String(it.library_name ?? ''),
          addedAt: new Date(Number(it.added_at) * 1000),
          parentTitle: typeof it.parent_title === 'string' ? it.parent_title : undefined,
          grandparentTitle: typeof it.grandparent_title === 'string' ? it.grandparent_title : undefined,
          year: it.year ? Number(it.year) : undefined,
          summary: typeof it.summary === 'string' ? it.summary : undefined,
          thumb: typeof it.thumb === 'string' ? it.thumb : undefined,
          raw: it,
        }));
    },
  };
}

export type TautulliClient = ReturnType<typeof createTautulliClient>;
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/integrations/tautulli
git add -A
git commit -m "feat(kernel): tautulli client with users + recently-added"
```

---

### Task 11: TMDB client

**Files:** `src/kernel/integrations/tmdb.ts`, `src/kernel/integrations/tmdb.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/integrations/tmdb.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createTmdbClient } from './tmdb';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('TmdbClient', () => {
  it('searchMovie returns first match', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({
      results: [{ id: 1, title: 'X', vote_average: 7.5, poster_path: '/p.jpg', overview: 'o' }],
    }));
    const c = createTmdbClient({ apiKey: 'k', fetcher });
    const r = await c.searchMovie({ title: 'X', year: 2020 });
    expect(r).toMatchObject({ id: 1, rating: 7.5, posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg' });
  });

  it('searchMovie returns null on empty', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ results: [] }));
    const c = createTmdbClient({ apiKey: 'k', fetcher });
    expect(await c.searchMovie({ title: 'Y' })).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/integrations/tmdb.ts`:
```ts
import { TmdbError } from './errors';
import { fetchWithRetry } from './http';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

export interface TmdbOpts {
  apiKey: string;
  fetcher?: typeof fetch;
}
export interface TmdbItem {
  id: number;
  title: string;
  rating: number;
  posterUrl: string | null;
  overview: string;
}

export function createTmdbClient(opts: TmdbOpts) {
  async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('api_key', opts.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchWithRetry(url.toString(), {}, { fetcher: opts.fetcher });
    if (!res.ok) throw new TmdbError(`HTTP ${res.status}`, res.status, res.status >= 500);
    return res.json() as Promise<T>;
  }

  function pickFirst(results: any[], type: 'movie' | 'tv'): TmdbItem | null {
    if (!results || results.length === 0) return null;
    const r = results[0];
    return {
      id: r.id,
      title: type === 'movie' ? (r.title ?? r.original_title) : (r.name ?? r.original_name),
      rating: typeof r.vote_average === 'number' ? r.vote_average : 0,
      posterUrl: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : null,
      overview: r.overview ?? '',
    };
  }

  return {
    async searchMovie(args: { title: string; year?: number }): Promise<TmdbItem | null> {
      const params: Record<string, string> = { query: args.title };
      if (args.year) params.year = String(args.year);
      const data = await call<{ results: any[] }>('/search/movie', params);
      return pickFirst(data.results, 'movie');
    },
    async searchTv(args: { title: string; firstAirYear?: number }): Promise<TmdbItem | null> {
      const params: Record<string, string> = { query: args.title };
      if (args.firstAirYear) params.first_air_date_year = String(args.firstAirYear);
      const data = await call<{ results: any[] }>('/search/tv', params);
      return pickFirst(data.results, 'tv');
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/integrations/tmdb
git add -A
git commit -m "feat(kernel): tmdb search client"
```

---

### Task 12: Resend client wrapper + webhook signature verify

**Files:** `src/kernel/integrations/resend.ts`, `src/kernel/integrations/resend.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/integrations/resend.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyResendSignature } from './resend';

describe('verifyResendSignature', () => {
  it('accepts valid signature', () => {
    const secret = 'whsec_test';
    const body = '{"type":"email.delivered"}';
    const ts = '1700000000';
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(verifyResendSignature({ body, header: `t=${ts},v1=${sig}`, secret })).toBe(true);
  });

  it('rejects tampered body', () => {
    const secret = 'whsec_test';
    const ts = '1700000000';
    const sig = createHmac('sha256', secret).update(`${ts}.original`).digest('hex');
    expect(verifyResendSignature({ body: 'tampered', header: `t=${ts},v1=${sig}`, secret })).toBe(false);
  });

  it('rejects malformed header', () => {
    expect(verifyResendSignature({ body: 'x', header: 'garbage', secret: 'x' })).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/integrations/resend.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import { ResendError } from './errors';

export function createResendClient(apiKey: string) {
  return new Resend(apiKey);
}

export interface VerifyOpts {
  body: string;
  header: string | null;
  secret: string;
}

export function verifyResendSignature(opts: VerifyOpts): boolean {
  if (!opts.header) return false;
  const parts = Object.fromEntries(
    opts.header.split(',').map(s => s.trim().split('=', 2)).filter(p => p.length === 2),
  ) as Record<string, string>;
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const computed = createHmac('sha256', opts.secret).update(`${ts}.${opts.body}`).digest('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export { ResendError };
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/integrations/resend
git add -A
git commit -m "feat(kernel): resend client + webhook signature verification"
```

---

### Task 13: HMAC unsubscribe tokens

**Files:** `src/kernel/email/unsubscribe.ts`, `src/kernel/email/unsubscribe.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/email/unsubscribe.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';

describe('unsubscribe tokens', () => {
  const secret = 'a'.repeat(32);
  it('round-trips an email', () => {
    const tok = generateUnsubscribeToken('u@x.io', secret);
    expect(verifyUnsubscribeToken(tok, secret)).toEqual({ email: 'u@x.io' });
  });
  it('rejects tampered tokens', () => {
    const tok = generateUnsubscribeToken('u@x.io', secret) + 'x';
    expect(verifyUnsubscribeToken(tok, secret)).toBeNull();
  });
  it('rejects with wrong secret', () => {
    const tok = generateUnsubscribeToken('u@x.io', secret);
    expect(verifyUnsubscribeToken(tok, 'b'.repeat(32))).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/email/unsubscribe.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function generateUnsubscribeToken(email: string, secret: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ email, t: Date.now() })));
  const sig = b64url(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): { email: string } | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const got = b64urlDecode(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(payload).toString('utf8'));
    if (typeof parsed.email !== 'string') return null;
    return { email: parsed.email };
  } catch { return null; }
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/email
git add -A
git commit -m "feat(kernel): hmac-signed unsubscribe tokens"
```

---

## Phase 4 — Newsletter module: schema, filters, template

### Task 14: Newsletter schema (Drizzle tables)

**Files:** `src/modules/newsletter/schema.ts`

- [ ] **Step 1: Implement**

```ts
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const digests = sqliteTable('digests', {
  id: text('id').primaryKey(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
  ranAt: integer('ran_at', { mode: 'timestamp_ms' }),
  windowStart: integer('window_start', { mode: 'timestamp_ms' }).notNull(),
  windowEnd: integer('window_end', { mode: 'timestamp_ms' }).notNull(),
  status: text('status').$type<'pending' | 'rendered' | 'sending' | 'sent' | 'skipped' | 'failed'>().notNull(),
  itemCount: integer('item_count').notNull().default(0),
  renderedHtml: text('rendered_html'),
  renderedSubject: text('rendered_subject'),
  error: text('error'),
}, t => ({
  scheduledAtIdx: uniqueIndex('digests_scheduled_at_uniq').on(t.scheduledAt),
}));

export const sends = sqliteTable('sends', {
  id: text('id').primaryKey(),
  digestId: text('digest_id').notNull().references(() => digests.id),
  recipientEmail: text('recipient_email').notNull(),
  recipientName: text('recipient_name').notNull(),
  resendMessageId: text('resend_message_id'),
  status: text('status').$type<'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'>().notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  error: text('error'),
}, t => ({
  digestIdx: index('sends_digest_idx').on(t.digestId),
  emailIdx: index('sends_email_idx').on(t.recipientEmail),
}));

export const sendEvents = sqliteTable('send_events', {
  id: text('id').primaryKey(),
  sendId: text('send_id').references(() => sends.id),
  resendMessageId: text('resend_message_id').notNull(),
  type: text('type').notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
  payload: text('payload').notNull(),
});

export const recipientsCache = sqliteTable('recipients_cache', {
  email: text('email').primaryKey(),
  name: text('name').notNull(),
  plexUsername: text('plex_username'),
  lastSynced: integer('last_synced', { mode: 'timestamp_ms' }).notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const itemsCache = sqliteTable('items_cache', {
  guid: text('guid').primaryKey(),
  payload: text('payload').notNull(),
  addedAt: integer('added_at', { mode: 'timestamp_ms' }).notNull(),
  cachedAt: integer('cached_at', { mode: 'timestamp_ms' }).notNull(),
});

export const unsubscribes = sqliteTable('unsubscribes', {
  token: text('token').primaryKey(),
  email: text('email').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
});
```

- [ ] **Step 2: Generate migration**

```bash
pnpm drizzle-kit generate --name newsletter
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(newsletter): drizzle schema for digests + sends + caches"
```

---

### Task 15: Filters

**Files:** `src/modules/newsletter/types.ts`, `src/modules/newsletter/filters.ts`, `src/modules/newsletter/filters.test.ts`

- [ ] **Step 1: Module types**

`src/modules/newsletter/types.ts`:
```ts
export interface EnrichedItem {
  guid: string;
  title: string;
  mediaType: 'movie' | 'show' | 'episode' | 'season' | string;
  libraryName: string;
  addedAt: Date;
  year?: number;
  rating: number;
  posterUrl: string | null;
  overview: string;
  showTitle?: string;
  seasonNumber?: number;
  episodeCount?: number;
  genres?: string[];
}
```

- [ ] **Step 2: Failing tests**

`src/modules/newsletter/filters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyFilters } from './filters';
import type { EnrichedItem } from './types';

const base = (over: Partial<EnrichedItem>): EnrichedItem => ({
  guid: 'g', title: 't', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date(), rating: 7, posterUrl: null, overview: '',
  ...over,
});

describe('applyFilters', () => {
  it('drops items below min_tmdb_rating', () => {
    const items = [base({ guid: 'a', rating: 4 }), base({ guid: 'b', rating: 8 })];
    const out = applyFilters(items, { min_tmdb_rating: 6, dedupe_episodes_into_seasons: false, max_items_per_section: 99, exclude_genres: [] });
    expect(out.map(i => i.guid)).toEqual(['b']);
  });

  it('restricts to include_libraries', () => {
    const items = [base({ guid: 'a', libraryName: 'Movies' }), base({ guid: 'b', libraryName: 'Music' })];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: false, max_items_per_section: 99, exclude_genres: [] }, ['Movies']);
    expect(out.map(i => i.guid)).toEqual(['a']);
  });

  it('rolls episodes up to a season row with episode_count', () => {
    const items = [
      base({ guid: 'e1', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E1' }),
      base({ guid: 'e2', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E2' }),
      base({ guid: 'e3', mediaType: 'episode', showTitle: 'X', seasonNumber: 2, libraryName: 'TV Shows', title: 'E3' }),
    ];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 99, exclude_genres: [] });
    const tv = out.filter(i => i.libraryName === 'TV Shows');
    expect(tv).toHaveLength(2);
    expect(tv.find(i => i.seasonNumber === 1)?.episodeCount).toBe(2);
    expect(tv.find(i => i.seasonNumber === 2)?.episodeCount).toBe(1);
  });

  it('caps per-section count', () => {
    const items = Array.from({ length: 20 }, (_, i) => base({ guid: `g${i}` }));
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: false, max_items_per_section: 5, exclude_genres: [] });
    expect(out).toHaveLength(5);
  });

  it('drops excluded genres', () => {
    const items = [base({ guid: 'a', genres: ['Horror'] }), base({ guid: 'b', genres: ['Drama'] })];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: false, max_items_per_section: 99, exclude_genres: ['Horror'] });
    expect(out.map(i => i.guid)).toEqual(['b']);
  });
});
```

- [ ] **Step 3: Implement**

`src/modules/newsletter/filters.ts`:
```ts
import type { EnrichedItem } from './types';

export interface FilterOpts {
  min_tmdb_rating: number;
  dedupe_episodes_into_seasons: boolean;
  max_items_per_section: number;
  exclude_genres: string[];
}

export function applyFilters(
  items: EnrichedItem[],
  opts: FilterOpts,
  includeLibraries?: string[] | null,
): EnrichedItem[] {
  const excludedGenres = new Set(opts.exclude_genres.map(g => g.toLowerCase()));
  let working = items
    .filter(i => i.rating >= opts.min_tmdb_rating)
    .filter(i => !includeLibraries?.length || includeLibraries.includes(i.libraryName))
    .filter(i => !i.genres || !i.genres.some(g => excludedGenres.has(g.toLowerCase())));

  if (opts.dedupe_episodes_into_seasons) {
    const rolledUp = new Map<string, EnrichedItem>();
    const kept: EnrichedItem[] = [];
    for (const item of working) {
      if (item.mediaType === 'episode' && item.showTitle && item.seasonNumber !== undefined) {
        const key = `${item.showTitle}::S${item.seasonNumber}::${item.libraryName}`;
        const existing = rolledUp.get(key);
        if (existing) {
          existing.episodeCount = (existing.episodeCount ?? 1) + 1;
          continue;
        }
        const season: EnrichedItem = {
          ...item,
          mediaType: 'season',
          title: `${item.showTitle} — Season ${item.seasonNumber}`,
          episodeCount: 1,
        };
        rolledUp.set(key, season);
        kept.push(season);
      } else {
        kept.push(item);
      }
    }
    working = kept;
  }

  const bySection = new Map<string, EnrichedItem[]>();
  for (const item of working) {
    const list = bySection.get(item.libraryName) ?? [];
    list.push(item);
    bySection.set(item.libraryName, list);
  }
  const capped: EnrichedItem[] = [];
  for (const [, list] of bySection) {
    list.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    capped.push(...list.slice(0, opts.max_items_per_section));
  }
  return capped;
}
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test src/modules/newsletter/filters
git add -A
git commit -m "feat(newsletter): filter pipeline — rating, library, dedupe, cap"
```

---

### Task 16: Digest template (react-email)

**Files:** `src/modules/newsletter/templates/digest.tsx`, `src/modules/newsletter/templates/digest.test.ts`

- [ ] **Step 1: Failing test**

`src/modules/newsletter/templates/digest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { DigestEmail } from './digest';
import type { EnrichedItem } from '../types';

const items: EnrichedItem[] = [{
  guid: 'g1', title: 'A Movie', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date('2026-05-01T00:00:00Z'), rating: 7.4,
  posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg', overview: 'A summary',
}];

describe('DigestEmail', () => {
  it('renders subject + sections', async () => {
    const html = await render(DigestEmail({ items, unsubscribeUrl: 'https://x/u', appName: 'Tortuga' }));
    expect(html).toContain('A Movie');
    expect(html).toContain('Movies');
    expect(html).toContain('Unsubscribe');
  });
});
```

- [ ] **Step 2: Implement**

`src/modules/newsletter/templates/digest.tsx`:
```tsx
import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text, Hr } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../types';

export interface DigestEmailProps {
  items: EnrichedItem[];
  unsubscribeUrl: string;
  appName: string;
}

export function DigestEmail({ items, unsubscribeUrl, appName }: DigestEmailProps) {
  const sections = new Map<string, EnrichedItem[]>();
  for (const it of items) {
    const list = sections.get(it.libraryName) ?? [];
    list.push(it);
    sections.set(it.libraryName, list);
  }
  return (
    <Html>
      <Head />
      <Preview>{`New on ${appName} this week — ${items.length} items`}</Preview>
      <Body style={{ background: '#0f1115', color: '#e7e9ee', fontFamily: 'ui-sans-serif, system-ui, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
          <Heading as="h1" style={{ margin: 0, fontSize: 28, letterSpacing: -0.5 }}>New on {appName}</Heading>
          <Text style={{ color: '#9aa4b2', marginTop: 4 }}>Here's what landed this week.</Text>
          {Array.from(sections.entries()).map(([library, group]) => (
            <Section key={library} style={{ marginTop: 32 }}>
              <Heading as="h2" style={{ fontSize: 18, color: '#cdd5e0', borderBottom: '1px solid #1e242e', paddingBottom: 8 }}>
                {library}
              </Heading>
              {group.map(item => (
                <Section key={item.guid} style={{ marginTop: 16 }}>
                  {item.posterUrl && (
                    <Img src={item.posterUrl} alt="" width={96} height={144} style={{ borderRadius: 6 }} />
                  )}
                  <Text style={{ fontWeight: 600, fontSize: 16, margin: '8px 0 0' }}>
                    {item.title}{item.year ? <span style={{ color: '#9aa4b2', fontWeight: 400 }}>{` (${item.year})`}</span> : null}
                  </Text>
                  {item.episodeCount ? (
                    <Text style={{ color: '#9aa4b2', margin: '4px 0' }}>
                      {item.episodeCount} new episode{item.episodeCount === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                  {item.rating > 0 ? (
                    <Text style={{ color: '#9aa4b2', margin: '4px 0' }}>★ {item.rating.toFixed(1)}</Text>
                  ) : null}
                  <Text style={{ color: '#cdd5e0', margin: '8px 0 0', fontSize: 14 }}>
                    {item.overview.length > 280 ? item.overview.slice(0, 277) + '…' : item.overview}
                  </Text>
                </Section>
              ))}
            </Section>
          ))}
          <Hr style={{ borderColor: '#1e242e', marginTop: 40 }} />
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>
            You're receiving this because you have access to {appName}.{' '}
            <Link href={unsubscribeUrl} style={{ color: '#9aa4b2' }}>Unsubscribe</Link>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/modules/newsletter/templates
git add -A
git commit -m "feat(newsletter): digest react-email template"
```

---

## Phase 5 — Pipeline

### Task 17: Recipients sync

**Files:** `src/modules/newsletter/pipeline/recipients.ts`, `src/modules/newsletter/pipeline/recipients.test.ts`

- [ ] **Step 1: Failing test**

`src/modules/newsletter/pipeline/recipients.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { syncRecipients } from './recipients';
import { recipientsCache } from '../schema';

describe('syncRecipients', () => {
  it('upserts users with non-null emails as active', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const tautulli = {
      getUsers: async () => [
        { plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' },
        { plexUserId: 2, name: 'B', plexUsername: 'b', email: null },
      ],
    } as any;
    const result = await syncRecipients(db, tautulli);
    expect(result.synced).toBe(1);
    expect(result.skippedNoEmail).toBe(1);
    const rows = db.select().from(recipientsCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(true);
  });

  it('preserves active=false for existing rows', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    db.insert(recipientsCache).values({
      email: 'a@x.io', name: 'old', plexUsername: 'a', lastSynced: new Date(0), active: false,
    }).run();
    const tautulli = { getUsers: async () => [{ plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' }] } as any;
    await syncRecipients(db, tautulli);
    const row = db.select().from(recipientsCache).all()[0];
    expect(row.active).toBe(false);
    expect(row.name).toBe('A');
  });
});
```

- [ ] **Step 2: Implement**

`src/modules/newsletter/pipeline/recipients.ts`:
```ts
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import type { TautulliClient } from '@/kernel/integrations/tautulli';
import { recipientsCache } from '../schema';

export async function syncRecipients(db: Db, tautulli: TautulliClient) {
  const users = await tautulli.getUsers();
  let synced = 0;
  let skippedNoEmail = 0;
  for (const u of users) {
    if (!u.email) { skippedNoEmail++; continue; }
    const existing = db.select().from(recipientsCache).where(eq(recipientsCache.email, u.email)).all();
    if (existing.length === 0) {
      db.insert(recipientsCache).values({
        email: u.email, name: u.name, plexUsername: u.plexUsername,
        lastSynced: new Date(), active: true,
      }).run();
    } else {
      db.update(recipientsCache).set({
        name: u.name, plexUsername: u.plexUsername, lastSynced: new Date(),
      }).where(eq(recipientsCache.email, u.email)).run();
    }
    synced++;
  }
  return { synced, skippedNoEmail };
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/modules/newsletter/pipeline/recipients
git add -A
git commit -m "feat(newsletter): recipients sync preserves unsubscribe state"
```

---

### Task 18: TMDB enrichment with cache

**Files:** `src/modules/newsletter/pipeline/enrich.ts`, `src/modules/newsletter/pipeline/enrich.test.ts`

- [ ] **Step 1: Failing test**

`src/modules/newsletter/pipeline/enrich.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { enrichItems } from './enrich';
import type { TautulliItem } from '@/kernel/integrations/tautulli';
import { itemsCache } from '../schema';

const fakeTmdb = {
  searchMovie: vi.fn().mockImplementation(async ({ title }) => ({
    id: 1, title, rating: 7, posterUrl: 'http://p/x.jpg', overview: 'o',
  })),
  searchTv: vi.fn().mockResolvedValue({ id: 2, title: 'show', rating: 8, posterUrl: null, overview: 'o' }),
};

const item: TautulliItem = {
  guid: 'g1', title: 'M', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date(), year: 2020, raw: {},
};

describe('enrichItems', () => {
  it('queries TMDB for movies, caches results', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const out = await enrichItems(db, fakeTmdb as any, [item]);
    expect(out[0].rating).toBe(7);
    expect(db.select().from(itemsCache).all()).toHaveLength(1);
  });

  it('uses cache on second call', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await enrichItems(db, fakeTmdb as any, [item]);
    const callsBefore = fakeTmdb.searchMovie.mock.calls.length;
    await enrichItems(db, fakeTmdb as any, [item]);
    expect(fakeTmdb.searchMovie.mock.calls.length).toBe(callsBefore);
  });
});
```

- [ ] **Step 2: Implement**

`src/modules/newsletter/pipeline/enrich.ts`:
```ts
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import type { TmdbClient } from '@/kernel/integrations/tmdb';
import type { TautulliItem } from '@/kernel/integrations/tautulli';
import { itemsCache } from '../schema';
import type { EnrichedItem } from '../types';

const CONCURRENCY = 5;

async function mapWithConcurrency<I, O>(items: I[], fn: (i: I) => Promise<O>, limit: number): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function enrichItems(db: Db, tmdb: TmdbClient, items: TautulliItem[]): Promise<EnrichedItem[]> {
  return mapWithConcurrency(items, async (item) => {
    const cached = db.select().from(itemsCache).where(eq(itemsCache.guid, item.guid)).all();
    if (cached.length > 0) {
      return JSON.parse(cached[0].payload) as EnrichedItem;
    }
    const isTv = item.mediaType === 'episode' || item.mediaType === 'season' || item.mediaType === 'show';
    const searchTitle = item.grandparentTitle ?? item.title;
    const tmdbRes = isTv
      ? await tmdb.searchTv({ title: searchTitle })
      : await tmdb.searchMovie({ title: item.title, year: item.year });

    const enriched: EnrichedItem = {
      guid: item.guid,
      title: item.title,
      mediaType: item.mediaType,
      libraryName: item.libraryName,
      addedAt: item.addedAt,
      year: item.year,
      rating: tmdbRes?.rating ?? 0,
      posterUrl: tmdbRes?.posterUrl ?? null,
      overview: tmdbRes?.overview ?? item.summary ?? '',
      showTitle: item.grandparentTitle,
      seasonNumber: typeof item.raw.parent_media_index === 'string' ? Number(item.raw.parent_media_index) : undefined,
    };
    db.insert(itemsCache).values({
      guid: item.guid,
      payload: JSON.stringify(enriched),
      addedAt: item.addedAt,
      cachedAt: new Date(),
    }).run();
    return enriched;
  }, CONCURRENCY);
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/modules/newsletter/pipeline/enrich
git add -A
git commit -m "feat(newsletter): tmdb enrichment with items cache"
```

---

### Task 19: runDigest orchestrator

**Files:** `src/modules/newsletter/pipeline/run.ts`, `src/modules/newsletter/pipeline/run.test.ts`

- [ ] **Step 1: Failing test**

`src/modules/newsletter/pipeline/run.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { runDigest } from './run';
import { digests, sends } from '../schema';

function fakes() {
  const tautulli = {
    getUsers: vi.fn().mockResolvedValue([
      { plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' },
    ]),
    getRecentlyAdded: vi.fn().mockResolvedValue([
      { guid: 'g1', title: 'M', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), year: 2020, raw: {} },
    ]),
  };
  const tmdb = {
    searchMovie: vi.fn().mockResolvedValue({ id: 1, title: 'M', rating: 8, posterUrl: null, overview: 'o' }),
    searchTv: vi.fn(),
  };
  const resend = {
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'msg_1' }, error: null }) },
  };
  return { tautulli, tmdb, resend };
}

const baseConfig = {
  schedule: '0 9 * * SUN', timezone: 'UTC', lookback_days: 7,
  from: { email: 'from@x.io', name: 'T' },
  filters: { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 12, exclude_genres: [] },
  featured: { enabled: false },
} as const;

describe('runDigest', () => {
  it('runs full pipeline and records a sent digest', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, resend } = fakes();
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, resend: resend as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-10T13:00:00Z'),
    });
    expect(result.status).toBe('sent');
    expect(result.itemCount).toBe(1);
    expect(db.select().from(sends).all()[0].status).toBe('sent');
  });

  it('skips when no items pass filters', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, resend } = fakes();
    tautulli.getRecentlyAdded.mockResolvedValue([]);
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, resend: resend as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-11T13:00:00Z'),
    });
    expect(result.status).toBe('skipped');
    expect(db.select().from(sends).all()).toHaveLength(0);
  });

  it('does not fan out on dry-run', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, resend } = fakes();
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, resend: resend as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-12T13:00:00Z'), dryRun: true,
    });
    expect(result.status).toBe('rendered');
    expect(db.select().from(sends).all()).toHaveLength(0);
  });

  it('refuses to double-fire same scheduled_at', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, resend } = fakes();
    const at = new Date('2026-05-13T13:00:00Z');
    await runDigest({ db, tautulli: tautulli as any, tmdb: tmdb as any, resend: resend as any, config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32), scheduledAt: at });
    await expect(
      runDigest({ db, tautulli: tautulli as any, tmdb: tmdb as any, resend: resend as any, config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32), scheduledAt: at }),
    ).rejects.toThrow(/UNIQUE/);
  });
});
```

- [ ] **Step 2: Implement**

`src/modules/newsletter/pipeline/run.ts`:
```ts
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { render } from '@react-email/render';
import { createElement } from 'react';

import type { Db } from '@/kernel/db/client';
import type { TautulliClient } from '@/kernel/integrations/tautulli';
import type { TmdbClient } from '@/kernel/integrations/tmdb';
import type { Resend } from 'resend';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { createLogger } from '@/kernel/logging/logger';

import { digests, sends, recipientsCache, unsubscribes } from '../schema';
import { applyFilters } from '../filters';
import { syncRecipients } from './recipients';
import { enrichItems } from './enrich';
import { DigestEmail } from '../templates/digest';

const log = createLogger('newsletter.run');

export interface RunDigestOpts {
  db: Db;
  tautulli: TautulliClient;
  tmdb: TmdbClient;
  resend: Resend;
  config: NewsletterConfig;
  appUrl: string;
  sessionSecret: string;
  scheduledAt: Date;
  dryRun?: boolean;
  recipientFilter?: (email: string) => boolean;
}

export async function runDigest(opts: RunDigestOpts) {
  const digestId = createId();
  const windowEnd = opts.scheduledAt;
  const windowStart = new Date(windowEnd.getTime() - opts.config.lookback_days * 86_400_000);
  opts.db.insert(digests).values({
    id: digestId, scheduledAt: opts.scheduledAt, windowStart, windowEnd,
    status: 'pending', itemCount: 0,
  }).run();

  try {
    await syncRecipients(opts.db, opts.tautulli);

    const raw = await opts.tautulli.getRecentlyAdded({ since: windowStart, count: 200 });
    const enriched = await enrichItems(opts.db, opts.tmdb, raw);
    const filtered = applyFilters(enriched, opts.config.filters, opts.config.include_libraries ?? null);

    if (filtered.length === 0) {
      opts.db.update(digests).set({ status: 'skipped', ranAt: new Date(), itemCount: 0 })
        .where(eq(digests.id, digestId)).run();
      return { id: digestId, status: 'skipped' as const, itemCount: 0 };
    }

    const previewRecipient = opts.db.select().from(recipientsCache).all().find(r => r.active);
    const placeholderUnsub = generateUnsubscribeToken(previewRecipient?.email ?? 'preview@example', opts.sessionSecret);
    const subject = `New on ${opts.config.from.name} — ${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
    const html = await render(createElement(DigestEmail, {
      items: filtered,
      unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${placeholderUnsub}`,
      appName: opts.config.from.name,
    }));

    opts.db.update(digests).set({
      status: 'rendered', itemCount: filtered.length,
      renderedHtml: html, renderedSubject: subject,
    }).where(eq(digests.id, digestId)).run();

    if (opts.dryRun) {
      return { id: digestId, status: 'rendered' as const, itemCount: filtered.length };
    }

    opts.db.update(digests).set({ status: 'sending' }).where(eq(digests.id, digestId)).run();
    const recipients = opts.db.select().from(recipientsCache).all()
      .filter(r => r.active)
      .filter(r => !opts.recipientFilter || opts.recipientFilter(r.email));

    let anySent = false;
    for (const r of recipients) {
      const sendId = createId();
      const tokenStr = generateUnsubscribeToken(r.email, opts.sessionSecret);
      opts.db.insert(unsubscribes).values({ token: tokenStr, email: r.email, createdAt: new Date() }).run();
      const perRecipientHtml = html.replace(/token=[^"&]+/, `token=${tokenStr}`);
      opts.db.insert(sends).values({
        id: sendId, digestId, recipientEmail: r.email, recipientName: r.name, status: 'queued',
      }).run();
      try {
        const res = await opts.resend.emails.send({
          from: `${opts.config.from.name} <${opts.config.from.email}>`,
          to: r.email,
          subject,
          html: perRecipientHtml,
          replyTo: opts.config.reply_to,
        });
        opts.db.update(sends).set({
          resendMessageId: res.data?.id ?? null,
          status: res.error ? 'failed' : 'sent',
          sentAt: new Date(),
          error: res.error?.message ?? null,
        }).where(eq(sends.id, sendId)).run();
        if (!res.error) anySent = true;
      } catch (e) {
        opts.db.update(sends).set({
          status: 'failed', error: e instanceof Error ? e.message : 'unknown', sentAt: new Date(),
        }).where(eq(sends.id, sendId)).run();
      }
    }

    opts.db.update(digests).set({
      status: anySent ? 'sent' : 'failed', ranAt: new Date(),
    }).where(eq(digests.id, digestId)).run();

    return { id: digestId, status: anySent ? 'sent' as const : 'failed' as const, itemCount: filtered.length };
  } catch (err) {
    log.error({ digest_id: digestId, err }, 'digest run failed');
    opts.db.update(digests).set({
      status: 'failed', ranAt: new Date(),
      error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
    }).where(eq(digests.id, digestId)).run();
    throw err;
  }
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/modules/newsletter/pipeline/run
git add -A
git commit -m "feat(newsletter): runDigest orchestrator with idempotency + dry-run"
```

---

## Phase 6 — Scheduler + module registration

### Task 20: Scheduler kernel wrapper

**Files:** `src/kernel/scheduler/scheduler.ts`, `src/kernel/scheduler/scheduler.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/scheduler/scheduler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';

describe('scheduler', () => {
  it('registers and lists jobs', () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    expect(s.list().map(j => j.name)).toEqual(['a']);
    s.stopAll();
  });
  it('stop unregisters and cancels', () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    s.stop('a');
    expect(s.list()).toEqual([]);
  });
  it('refuses duplicate names', () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    expect(() => s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() })).toThrow(/duplicate/);
    s.stopAll();
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/scheduler/scheduler.ts`:
```ts
import { Cron } from 'croner';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('scheduler');

export interface ScheduleSpec {
  name: string;
  cron: string;
  timezone: string;
  handler: () => Promise<void> | void;
}

export function createScheduler() {
  const jobs = new Map<string, { spec: ScheduleSpec; cron: Cron }>();
  return {
    register(spec: ScheduleSpec) {
      if (jobs.has(spec.name)) throw new Error(`duplicate schedule: ${spec.name}`);
      const cron = new Cron(spec.cron, { timezone: spec.timezone }, async () => {
        try { await spec.handler(); }
        catch (err) { log.error({ schedule: spec.name, err }, 'scheduled handler threw'); }
      });
      jobs.set(spec.name, { spec, cron });
    },
    stop(name: string) {
      const job = jobs.get(name);
      if (!job) return;
      job.cron.stop();
      jobs.delete(name);
    },
    stopAll() {
      for (const { cron } of jobs.values()) cron.stop();
      jobs.clear();
    },
    list() {
      return Array.from(jobs.values()).map(({ spec, cron }) => ({
        name: spec.name, cron: spec.cron, nextRun: cron.nextRun(),
      }));
    },
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/scheduler
git add -A
git commit -m "feat(kernel): croner scheduler wrapper"
```

---

### Task 21: App context (DI singleton)

**Files:** `src/kernel/context.ts`

- [ ] **Step 1: Implement**

```ts
import { loadEnv, loadYamlConfig } from './config/load';
import type { Env, YamlConfig } from './config/schema';
import { createDb, type Db } from './db/client';
import { applyMigrations } from './db/migrate';
import { createTautulliClient, type TautulliClient } from './integrations/tautulli';
import { createTmdbClient, type TmdbClient } from './integrations/tmdb';
import { createResendClient } from './integrations/resend';
import { createScheduler, type Scheduler } from './scheduler/scheduler';
import { Resend } from 'resend';

export interface AppContext {
  env: Env;
  config: YamlConfig;
  db: Db;
  tautulli: TautulliClient;
  tmdb: TmdbClient;
  resend: Resend;
  scheduler: Scheduler;
}

let cached: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cached) return cached;
  const env = loadEnv();
  const config = loadYamlConfig(env.CONFIG_PATH);
  const db = createDb(env.DATABASE_URL);
  applyMigrations(db);
  const tautulli = createTautulliClient({ url: env.TAUTULLI_URL, apiKey: env.TAUTULLI_API_KEY });
  const tmdb = createTmdbClient({ apiKey: env.TMDB_API_KEY });
  const resend = createResendClient(env.RESEND_API_KEY);
  const scheduler = createScheduler();
  cached = { env, config, db, tautulli, tmdb, resend, scheduler };
  return cached;
}

export function resetAppContextForTests() {
  cached = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(kernel): app context DI singleton"
```

---

### Task 22: Newsletter module registration

**Files:** `src/modules/newsletter/module.ts`, `src/modules/index.ts`

- [ ] **Step 1: module.ts**

```ts
import { getAppContext } from '@/kernel/context';
import { runDigest } from './pipeline/run';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('newsletter.module');

export function registerNewsletterModule() {
  const ctx = getAppContext();
  ctx.scheduler.register({
    name: 'newsletter.digest',
    cron: ctx.config.newsletter.schedule,
    timezone: ctx.config.newsletter.timezone,
    handler: async () => {
      log.info('scheduled digest firing');
      await runDigest({
        db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, resend: ctx.resend,
        config: ctx.config.newsletter,
        appUrl: ctx.env.APP_URL,
        sessionSecret: ctx.env.SESSION_SECRET,
        scheduledAt: new Date(),
      });
    },
  });
}
```

- [ ] **Step 2: barrel**

`src/modules/index.ts`:
```ts
import { registerNewsletterModule } from './newsletter/module';

export function registerAllModules() {
  registerNewsletterModule();
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(newsletter): module registers schedule at boot"
```

---

### Task 23: Boot init via Next.js instrumentation

**Files:** `src/instrumentation.ts`

- [ ] **Step 1: Implement**

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAllModules } = await import('./modules');
    registerAllModules();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: register modules at server boot via instrumentation hook"
```

---

## Phase 7 — Auth

### Task 24: Auth.js v5 (session mode) + admin bootstrap

**Files:** `src/kernel/auth/auth.ts`, `src/kernel/auth/bootstrap.ts`, `src/kernel/auth/auth.test.ts`

- [ ] **Step 1: Failing test for bootstrap**

`src/kernel/auth/auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { bootstrapAdminUser } from './bootstrap';
import { users } from '@/kernel/db/schema';

describe('bootstrapAdminUser', () => {
  it('creates a user if none exist', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await bootstrapAdminUser(db, { email: 'a@x.io', password: 'hunter22hunter22' });
    const rows = db.select().from(users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('a@x.io');
    expect(rows[0].passwordHash).toBeTruthy();
  });
  it('is a no-op when a user already exists', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await bootstrapAdminUser(db, { email: 'a@x.io', password: 'hunter22hunter22' });
    await bootstrapAdminUser(db, { email: 'b@x.io', password: 'hunter22hunter22' });
    expect(db.select().from(users).all()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement bootstrap**

`src/kernel/auth/bootstrap.ts`:
```ts
import argon2 from 'argon2';
import { createId } from '@paralleldrive/cuid2';
import type { Db } from '@/kernel/db/client';
import { users } from '@/kernel/db/schema';

export async function bootstrapAdminUser(db: Db, args: { email: string; password: string }) {
  const existing = db.select().from(users).all();
  if (existing.length > 0) return;
  const passwordHash = await argon2.hash(args.password, { type: argon2.argon2id });
  db.insert(users).values({
    id: createId(), email: args.email, passwordHash, createdAt: new Date(),
  }).run();
}
```

- [ ] **Step 3: Auth.js config**

`src/kernel/auth/auth.ts`:
```ts
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAppContext } from '@/kernel/context';
import { users } from '@/kernel/db/schema';

const CredsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = CredsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { db } = getAppContext();
        const found = db.select().from(users).where(eq(users.email, parsed.data.email)).all();
        if (found.length === 0 || !found[0].passwordHash) return null;
        const ok = await argon2.verify(found[0].passwordHash, parsed.data.password);
        if (!ok) return null;
        return { id: found[0].id, email: found[0].email };
      },
    }),
  ],
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
```

- [ ] **Step 4: Wire bootstrap into context init**

Update `src/kernel/context.ts` to optionally bootstrap on first access. Append to the body of `getAppContext`, after `applyMigrations(db)`:
```ts
if (env.AUTH_MODE === 'session' && env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  // dynamic import to keep argon2 out of edge runtimes
  import('./auth/bootstrap').then(({ bootstrapAdminUser }) =>
    bootstrapAdminUser(db, { email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! }));
}
```

- [ ] **Step 5: Pass + commit**

```bash
pnpm test src/kernel/auth
git add -A
git commit -m "feat(auth): session-mode Auth.js v5 + admin bootstrap"
```

---

### Task 25: Middleware (session OR ForwardAuth)

**Files:** `src/middleware.ts`, `src/kernel/auth/forward.ts`, `src/kernel/auth/forward.test.ts`

- [ ] **Step 1: Failing test**

`src/kernel/auth/forward.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { extractForwardUser } from './forward';

describe('extractForwardUser', () => {
  it('returns user when header present', () => {
    const req = new Request('http://x', { headers: { 'Remote-User': 'evan' } });
    expect(extractForwardUser(req, 'Remote-User')).toEqual({ id: 'evan', email: 'evan' });
  });
  it('null when missing', () => {
    expect(extractForwardUser(new Request('http://x'), 'Remote-User')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

`src/kernel/auth/forward.ts`:
```ts
export function extractForwardUser(req: Request, headerName: string): { id: string; email: string } | null {
  const value = req.headers.get(headerName);
  if (!value) return null;
  return { id: value, email: value };
}
```

`src/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/healthz',
  '/api/unsubscribe',
  '/api/webhooks/resend',
  '/api/auth',
];

export const config = {
  matcher: ['/((?!_next|favicon.ico|public|.*\\..*).*)'],
};

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  const mode = process.env.AUTH_MODE ?? 'session';
  if (mode === 'forward') {
    const header = process.env.AUTH_FORWARD_HEADER ?? 'Remote-User';
    if (!req.headers.get(header)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  // session mode protected by layout-level `auth()` checks (Edge-runtime safe).
  return NextResponse.next();
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/kernel/auth
git add -A
git commit -m "feat(auth): forward-auth middleware + session passthrough"
```

---

## Phase 8 — API routes

### Task 26: GET /api/healthz

**Files:** `src/app/api/healthz/route.ts`, `src/app/api/healthz/route.test.ts`

- [ ] **Step 1: Failing test**

`src/app/api/healthz/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({
    db: { $client: { prepare: () => ({ all: () => [{ 1: 1 }] }) } },
    tautulli: { getUsers: async () => [] },
    env: { RESEND_API_KEY: 'x' },
  }),
}));

import { GET } from './route';

describe('GET /api/healthz', () => {
  it('returns 200 with status payload', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.db).toBe('ok');
    expect(body.tautulli).toBe('ok');
  });
});
```

- [ ] **Step 2: Implement**

`src/app/api/healthz/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const out: Record<string, string> = { ts: new Date().toISOString() };
  try {
    const ctx = getAppContext();
    try { ctx.db.$client.prepare('select 1').all(); out.db = 'ok'; }
    catch { out.db = 'fail'; }
    try { await ctx.tautulli.getUsers(); out.tautulli = 'ok'; }
    catch { out.tautulli = 'fail'; }
    out.resend = ctx.env.RESEND_API_KEY ? 'ok' : 'unconfigured';
    const failed = Object.entries(out).some(([k, v]) => k !== 'ts' && v === 'fail');
    return NextResponse.json(out, { status: failed ? 503 : 200 });
  } catch (err) {
    return NextResponse.json({ ...out, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm test src/app/api/healthz
git add -A
git commit -m "feat(api): healthz endpoint"
```

---

### Task 27: POST /api/digests/run

**Files:** `src/app/api/digests/run/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import { auth } from '@/kernel/auth/auth';

export const dynamic = 'force-dynamic';

async function isAuthorized(req: Request): Promise<boolean> {
  const ctx = getAppContext();
  if (ctx.env.AUTH_MODE === 'forward') {
    return Boolean(req.headers.get(ctx.env.AUTH_FORWARD_HEADER));
  }
  const bearer = req.headers.get('authorization');
  if (bearer && ctx.env.DIGEST_RUN_TOKEN) {
    if (bearer === `Bearer ${ctx.env.DIGEST_RUN_TOKEN}`) return true;
  }
  const session = await auth();
  return Boolean(session?.user);
}

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = getAppContext();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const dryRun = body.dry_run === true;
  try {
    const result = await runDigest({
      db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, resend: ctx.resend,
      config: ctx.config.newsletter,
      appUrl: ctx.env.APP_URL, sessionSecret: ctx.env.SESSION_SECRET,
      scheduledAt: new Date(), dryRun,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(api): POST /api/digests/run with session/bearer auth"
```

---

### Task 28: POST /api/webhooks/resend

**Files:** `src/app/api/webhooks/resend/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getAppContext } from '@/kernel/context';
import { verifyResendSignature } from '@/kernel/integrations/resend';
import { sendEvents, sends } from '@/modules/newsletter/schema';
import { createLogger } from '@/kernel/logging/logger';

export const dynamic = 'force-dynamic';
const log = createLogger('webhook.resend');
const TERMINAL: Record<string, 'delivered' | 'bounced' | 'complained' | 'failed'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export async function POST(req: Request) {
  const ctx = getAppContext();
  const body = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  if (!secret) {
    log.warn('webhook received but RESEND_WEBHOOK_SECRET unset');
    return NextResponse.json({ error: 'not configured' }, { status: 401 });
  }
  if (!verifyResendSignature({ body, header: req.headers.get('Resend-Signature'), secret })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  const payload = JSON.parse(body) as { type: string; data?: { email_id?: string } };
  const resendMessageId = payload.data?.email_id ?? '';
  ctx.db.insert(sendEvents).values({
    id: createId(), sendId: null, resendMessageId, type: payload.type,
    receivedAt: new Date(), payload: body,
  }).run();
  const terminal = TERMINAL[payload.type];
  if (terminal && resendMessageId) {
    ctx.db.update(sends).set({ status: terminal })
      .where(eq(sends.resendMessageId, resendMessageId)).run();
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(api): resend webhook receiver with hmac verify"
```

---

### Task 29: GET /api/unsubscribe

**Files:** `src/app/api/unsubscribe/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { verifyUnsubscribeToken } from '@/kernel/email/unsubscribe';
import { recipientsCache, unsubscribes } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const ctx = getAppContext();
  const verified = verifyUnsubscribeToken(token, ctx.env.SESSION_SECRET);
  if (!verified) {
    return new NextResponse(htmlPage('Link no longer valid', 'This unsubscribe link is invalid or has been used.'), {
      status: 400, headers: { 'content-type': 'text/html' },
    });
  }
  ctx.db.update(recipientsCache).set({ active: false })
    .where(eq(recipientsCache.email, verified.email)).run();
  ctx.db.update(unsubscribes).set({ usedAt: new Date() })
    .where(eq(unsubscribes.token, token)).run();
  return new NextResponse(htmlPage("You're unsubscribed", 'You will no longer receive the newsletter.'), {
    headers: { 'content-type': 'text/html' },
  });
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e7e9ee;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{max-width:480px;background:#181c25;border-radius:12px;padding:32px}
  h1{margin:0 0 12px 0;font-size:22px}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(api): one-click unsubscribe endpoint"
```

---

### Task 30: Auth.js handler route

**Files:** `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Implement**

```ts
import { handlers } from '@/kernel/auth/auth';
export const GET = handlers.GET;
export const POST = handlers.POST;
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(api): auth.js handler routes"
```

---

## Phase 9 — Admin UI

### Task 31: Admin layout + login

**Files:** `src/app/(admin)/layout.tsx`, `src/app/(admin)/page.tsx`, `src/app/login/page.tsx`

- [ ] **Step 1: Login page**

`src/app/login/page.tsx`:
```tsx
import { signIn } from '@/kernel/auth/auth';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  async function action(formData: FormData) {
    'use server';
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    });
  }
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f1115', color: '#e7e9ee' }}>
      <form action={action} style={{ background: '#181c25', padding: 32, borderRadius: 12, width: 320 }}>
        <h1 style={{ margin: 0, marginBottom: 16 }}>Tortuga</h1>
        <input name="email" type="email" placeholder="Email" required style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required style={inputStyle} />
        {searchParams.error ? <p style={{ color: '#ff6b6b' }}>Invalid credentials.</p> : null}
        <button type="submit" style={btnStyle}>Sign in</button>
      </form>
    </main>
  );
}
const inputStyle = { display: 'block', width: '100%', padding: 8, marginBottom: 12, background: '#0f1115', color: '#e7e9ee', border: '1px solid #2a3140', borderRadius: 6 };
const btnStyle = { width: '100%', padding: 10, background: '#4f7cff', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600 };
```

- [ ] **Step 2: Admin layout**

`src/app/(admin)/layout.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/kernel/auth/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const mode = process.env.AUTH_MODE ?? 'session';
  if (mode === 'session') {
    const session = await auth();
    if (!session?.user) redirect('/login');
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', background: '#0f1115', color: '#e7e9ee' }}>
      <nav style={{ background: '#0b0d12', padding: 24, borderRight: '1px solid #1e242e' }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Tortuga</h1>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 24, display: 'grid', gap: 8 }}>
          <li><Link href="/">Dashboard</Link></li>
          <li><Link href="/newsletter">Newsletter</Link></li>
          <li><Link href="/newsletter/preview">Preview</Link></li>
          <li><Link href="/newsletter/history">History</Link></li>
          <li><Link href="/newsletter/recipients">Recipients</Link></li>
        </ul>
      </nav>
      <main style={{ padding: 32 }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Dashboard**

`src/app/(admin)/page.tsx`:
```tsx
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests, sends } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const ctx = getAppContext();
  const recent = ctx.db.select().from(digests).orderBy(desc(digests.scheduledAt)).limit(5).all();
  const sendCount = ctx.db.select().from(sends).all().length;
  return (
    <div>
      <h2>Overview</h2>
      <p>Last 5 digests:</p>
      <ul>
        {recent.map(d => (
          <li key={d.id}>{d.scheduledAt.toISOString()} — {d.status} ({d.itemCount} items)</li>
        ))}
      </ul>
      <p>Total send rows: {sendCount}</p>
    </div>
  );
}
```

- [ ] **Step 4: Smoke run**

```bash
TAUTULLI_URL=http://localhost:8181 TAUTULLI_API_KEY=x TMDB_API_KEY=x \
  RESEND_API_KEY=x APP_URL=http://localhost:3000 \
  SESSION_SECRET=$(node -e "console.log('a'.repeat(32))") \
  ADMIN_EMAIL=test@x.io ADMIN_PASSWORD=hunter22hunter22 \
  CONFIG_PATH=./tortuga.example.yml \
  DATABASE_URL=file:./config/tortuga.db \
  pnpm dev
```
Expected: `localhost:3000` redirects to `/login`. Login form renders.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): auth-protected layout, login, dashboard"
```

---

### Task 32: Newsletter preview page (server actions)

**Files:** `src/app/(admin)/newsletter/page.tsx`, `src/app/(admin)/newsletter/preview/page.tsx`

- [ ] **Step 1: Newsletter index**

`src/app/(admin)/newsletter/page.tsx`:
```tsx
import Link from 'next/link';

export default function NewsletterIndex() {
  return (
    <div>
      <h2>Newsletter</h2>
      <ul>
        <li><Link href="/newsletter/preview">Preview this week's digest (dry-run)</Link></li>
        <li><Link href="/newsletter/history">Send history</Link></li>
        <li><Link href="/newsletter/recipients">Recipients</Link></li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Preview page**

`src/app/(admin)/newsletter/preview/page.tsx`:
```tsx
import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import { digests } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

async function generate() {
  'use server';
  const ctx = getAppContext();
  await runDigest({
    db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, resend: ctx.resend,
    config: ctx.config.newsletter,
    appUrl: ctx.env.APP_URL, sessionSecret: ctx.env.SESSION_SECRET,
    scheduledAt: new Date(), dryRun: true,
  });
  revalidatePath('/newsletter/preview');
}

async function send() {
  'use server';
  const ctx = getAppContext();
  await runDigest({
    db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, resend: ctx.resend,
    config: ctx.config.newsletter,
    appUrl: ctx.env.APP_URL, sessionSecret: ctx.env.SESSION_SECRET,
    scheduledAt: new Date(),
  });
  revalidatePath('/newsletter/preview');
  revalidatePath('/newsletter/history');
}

export default function Preview() {
  const ctx = getAppContext();
  const latest = ctx.db.select().from(digests)
    .where(eq(digests.status, 'rendered'))
    .orderBy(desc(digests.scheduledAt))
    .limit(1).all();
  const html = latest[0]?.renderedHtml ?? '';
  return (
    <div>
      <h2>Preview</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <form action={generate}><button type="submit">Generate fresh preview</button></form>
        <form action={send}><button type="submit" style={{ background: '#4f7cff', color: '#fff' }}>Send now</button></form>
      </div>
      {html
        ? <iframe srcDoc={html} style={{ width: '100%', height: 800, background: '#fff', border: '1px solid #1e242e', borderRadius: 8 }} />
        : <p>No preview rendered yet. Click "Generate fresh preview".</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): newsletter index + preview/send-now actions"
```

---

### Task 33: History + recipients pages

**Files:** `src/app/(admin)/newsletter/history/page.tsx`, `src/app/(admin)/newsletter/recipients/page.tsx`

- [ ] **Step 1: History**

`src/app/(admin)/newsletter/history/page.tsx`:
```tsx
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests, sends } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export default function History() {
  const ctx = getAppContext();
  const rows = ctx.db.select().from(digests).orderBy(desc(digests.scheduledAt)).limit(50).all();
  const counts: Record<string, Record<string, number>> = {};
  for (const s of ctx.db.select({ digestId: sends.digestId, status: sends.status }).from(sends).all()) {
    counts[s.digestId] = counts[s.digestId] ?? {};
    counts[s.digestId][s.status] = (counts[s.digestId][s.status] ?? 0) + 1;
  }
  return (
    <div>
      <h2>History</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>When</th><th>Status</th><th>Items</th><th>Sent</th><th>Failed</th></tr>
        </thead>
        <tbody>
          {rows.map(d => (
            <tr key={d.id} style={{ borderTop: '1px solid #1e242e' }}>
              <td>{d.scheduledAt.toISOString()}</td>
              <td>{d.status}</td>
              <td>{d.itemCount}</td>
              <td>{counts[d.id]?.sent ?? 0}</td>
              <td>{counts[d.id]?.failed ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Recipients**

`src/app/(admin)/newsletter/recipients/page.tsx`:
```tsx
import { getAppContext } from '@/kernel/context';
import { recipientsCache } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export default function Recipients() {
  const ctx = getAppContext();
  const rows = ctx.db.select().from(recipientsCache).all();
  const active = rows.filter(r => r.active);
  const inactive = rows.filter(r => !r.active);
  return (
    <div>
      <h2>Recipients</h2>
      <p>{active.length} active, {inactive.length} unsubscribed.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th>Email</th><th>Name</th><th>Plex</th><th>Active</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.email} style={{ borderTop: '1px solid #1e242e' }}>
              <td>{r.email}</td><td>{r.name}</td><td>{r.plexUsername}</td><td>{r.active ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): history + recipients pages"
```

---

## Phase 10 — Containerize

### Task 34: Dockerfile + .dockerignore + docker-compose example

**Files:** `Dockerfile`, `.dockerignore`, `docker-compose.example.yml`

- [ ] **Step 1: `.dockerignore`**

```
node_modules
.next
.git
.github
playwright-report
test-results
coverage
docs
*.md
.env*
config
```

- [ ] **Step 2: Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm drizzle-kit generate || true
RUN pnpm build

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini sqlite
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CONFIG_PATH=/config/tortuga.yml \
    DATABASE_URL=file:/config/tortuga.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3000
VOLUME ["/config"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

- [ ] **Step 3: docker-compose example**

`docker-compose.example.yml`:
```yaml
services:
  tortuga:
    image: ghcr.io/evandcoleman/tortuga:latest
    container_name: tortuga
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
    environment:
      TAUTULLI_URL: "http://tautulli:8181"
      TAUTULLI_API_KEY: "${TAUTULLI_API_KEY}"
      TMDB_API_KEY: "${TMDB_API_KEY}"
      RESEND_API_KEY: "${RESEND_API_KEY}"
      RESEND_WEBHOOK_SECRET: "${RESEND_WEBHOOK_SECRET}"
      APP_URL: "${APP_URL:-http://localhost:3000}"
      SESSION_SECRET: "${SESSION_SECRET}"
      ADMIN_EMAIL: "${ADMIN_EMAIL}"
      ADMIN_PASSWORD: "${ADMIN_PASSWORD}"
      AUTH_MODE: "${AUTH_MODE:-session}"
    restart: unless-stopped
```

- [ ] **Step 4: Build locally + commit**

```bash
docker build -t tortuga:dev .
git add -A
git commit -m "chore: dockerfile + compose example"
```

---

### Task 35: GitHub Actions — CI + release

**Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`

- [ ] **Step 1: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Release workflow**

`.github/workflows/release.yml`:
```yaml
name: release
on:
  push:
    branches: [main]
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/tortuga
          tags: |
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}
            type=semver,pattern={{version}}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: test + publish docker image to ghcr"
```

---

## Phase 11 — Smoke test

### Task 36: Playwright smoke test

**Files:** `playwright.config.ts`, `e2e/admin.spec.ts`

- [ ] **Step 1: Playwright config**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Smoke test**

`e2e/admin.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('login screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByPlaceholder('Email')).toBeVisible();
});
```

- [ ] **Step 3: Add scripts to `package.json`**

```json
"e2e": "playwright test",
"e2e:install": "playwright install chromium"
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(e2e): playwright smoke test for login screen"
```

---

## Phase 12 — README

### Task 37: README

**Files:** `README.md`

- [ ] **Step 1: Write README**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: README with quickstart and env reference"
```

---

## Phase 13 — Olympus deployment

### Task 38: Vault secrets + policy + CSI volume + Nomad job + versions.json

**Files (in the sibling olympus repo at `../olympus/`):**
- Create: `../olympus/jobs/tortuga/job.nomad`, `../olympus/vault-policies/tortuga.hcl`, `../olympus/volumes/tortuga-config.hcl`
- Modify: `../olympus/versions.json`

- [ ] **Step 1: Seed Vault KV**

```bash
export VAULT_ADDR=http://<vault-host>:8200
vault kv put kv/tortuga \
  session_secret="$(openssl rand -hex 32)" \
  digest_run_token="$(openssl rand -hex 24)" \
  resend_api_key="<from resend dashboard>" \
  resend_webhook_secret="<from resend webhook config>" \
  tmdb_api_key="<from tmdb>"
```

- [ ] **Step 2: Vault policy**

`../olympus/vault-policies/tortuga.hcl`:
```hcl
path "kv/data/tortuga" {
  capabilities = ["read"]
}

path "kv/data/tautulli" {
  capabilities = ["read"]
}
```

Apply:
```bash
vault policy write tortuga ../olympus/vault-policies/tortuga.hcl
```

- [ ] **Step 3: CSI volume**

Create dir on NAS + ACL:
```bash
ssh <nas-host> 'sudo mkdir -p /volume1/Cluster/data/tortuga && sudo /usr/syno/bin/synoacltool -add /volume1/Cluster/data/tortuga "group:administrators:allow:rwxpdDaARWc--:fd--"'
```

`../olympus/volumes/tortuga-config.hcl`:
```hcl
id        = "tortuga-config"
name      = "tortuga-config"
type      = "csi"
plugin_id = "nfs-csi"
capability {
  access_mode     = "single-node-writer"
  attachment_mode = "file-system"
}
context {
  server = "<nas-host>"
  share  = "/volume1/Cluster/data/tortuga"
}
```

Register:
```bash
nomad volume register ../olympus/volumes/tortuga-config.hcl
```

- [ ] **Step 4: Seed `/config/tortuga.yml` on the NAS**

```bash
ssh <nas-host> 'sudo tee /volume1/Cluster/data/tortuga/tortuga.yml' < tortuga.example.yml
# then edit on the NAS with real values
```

- [ ] **Step 5: Job spec**

`../olympus/jobs/tortuga/job.nomad`:
```hcl
variable "image" {
  type    = string
  default = "ghcr.io/evandcoleman/tortuga:latest"
}

job "tortuga" {
  datacenters = ["olympus"]
  region      = "us-east-1"
  type        = "service"

  group "tortuga" {
    count = 1

    constraint {
      attribute = "${node.class}"
      value     = "linux"
    }

    network {
      port "http" { to = 3000 }
    }

    volume "config" {
      type            = "csi"
      source          = "tortuga-config"
      access_mode     = "single-node-writer"
      attachment_mode = "file-system"
    }

    vault {
      policies = ["tortuga"]
    }

    service {
      name = "tortuga"
      port = "http"
      tags = [
        "logs.promtail=true",
        "proxy", "public", "auth",
      ]
      check {
        type     = "http"
        path     = "/api/healthz"
        interval = "30s"
        timeout  = "5s"
      }
    }

    task "server" {
      driver = "docker"
      config {
        image = var.image
        ports = ["http"]
        auth {
          username = "${DOCKER_USER}"
          password = "${DOCKER_PASS}"
        }
      }
      volume_mount {
        volume      = "config"
        destination = "/config"
      }
      env {
        TZ                  = "America/New_York"
        APP_URL             = "https://tortuga.example.com"
        TAUTULLI_URL        = "http://tautulli.service.consul:8181"
        AUTH_MODE           = "forward"
        AUTH_FORWARD_HEADER = "Remote-User"
        CONFIG_PATH         = "/config/tortuga.yml"
        DATABASE_URL        = "file:/config/tortuga.db"
      }
      template {
        data = <<EOF
          {{ with secret "kv/data/tortuga" }}
          SESSION_SECRET="{{ .Data.data.session_secret }}"
          DIGEST_RUN_TOKEN="{{ .Data.data.digest_run_token }}"
          RESEND_API_KEY="{{ .Data.data.resend_api_key }}"
          RESEND_WEBHOOK_SECRET="{{ .Data.data.resend_webhook_secret }}"
          TMDB_API_KEY="{{ .Data.data.tmdb_api_key }}"
          {{ end }}
          {{ with secret "kv/data/tautulli" }}
          TAUTULLI_API_KEY="{{ .Data.data.api_key }}"
          {{ end }}
          {{ with secret "kv/data/github" }}
          DOCKER_USER="{{ .Data.data.container_registry_username }}"
          DOCKER_PASS="{{ .Data.data.container_registry_token }}"
          {{ end }}
        EOF
        destination = "secrets/vault.env"
        env         = true
      }
      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
```

- [ ] **Step 6: Bump versions.json**

Add to `../olympus/versions.json`:
```json
"tortuga": "ghcr.io/evandcoleman/tortuga:latest"
```

- [ ] **Step 7: Validate + deploy**

```bash
cd ../olympus
just validate tortuga
just deploy-safe tortuga
just status tortuga
just logs tortuga
```

- [ ] **Step 8: Live smoke**

Browser: `https://tortuga.example.com` → Authelia gate → admin UI loads → **Newsletter → Preview** → "Generate fresh preview" renders.

- [ ] **Step 9: Commit olympus repo**

```bash
cd ../olympus
git add jobs/tortuga vault-policies/tortuga.hcl volumes/tortuga-config.hcl versions.json
git commit -m "feat: deploy tortuga newsletter app"
git push
```

---

## Self-review summary

- **Spec coverage:** every spec section maps to at least one task — kernel (Tasks 4-13, 20-25), schema (14), filters (15), template (16), pipeline (17-19), scheduler+modules (20-23), auth (24-25), API routes (26-30), admin UI (31-33), container/CI (34-35), e2e (36), docs (37), olympus deployment (38).
- **Placeholder scan:** no TBDs, no "implement later", no "similar to Task N." Each step contains executable code or shell.
- **Type consistency:** `EnrichedItem`, `TautulliItem`, `RunDigestOpts` are defined once and referenced consistently across pipeline/route/server-action call sites.
- **Known soft spot worth tracking:** the `html.replace(/token=[^"&]+/, ...)` trick in `runDigest` for per-recipient unsubscribe tokens is fragile if templates ever place the token outside a querystring context. Acceptable for v1; revisit when templates evolve.
