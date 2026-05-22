# Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app `/settings` admin page that edits the newsletter YAML config, persists it as a DB override on the writable `/config` volume, and hot-reloads it in-process with no container restart.

**Architecture:** A single `config_overrides` row in `tortuga.db` becomes the source of truth once saved (the `tortuga.yml` file is the seed default). `getAppContext()` resolves the override before the file. `invalidateAppContext()` stops the old cron scheduler, clears the singleton, rebuilds it, and re-registers modules — valid because the Nomad job runs `count = 1`. Secrets stay Vault/env-managed and are shown read-only.

**Tech Stack:** Next.js 16 (App Router, React 19 `useActionState`), Drizzle ORM + better-sqlite3, Zod, Vitest, Playwright, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-22-settings-ui-design.md`

---

## File Structure

- Create: `src/kernel/config/overrides.ts` — read/write/clear the config override row (pure Drizzle data access).
- Create: `src/kernel/config/overrides.test.ts` — unit tests for the repository.
- Create: `drizzle/0003_config_overrides.sql` (+ updated `drizzle/meta/_journal.json`) — generated migration.
- Modify: `src/kernel/db/schema.ts` — add the `configOverrides` table.
- Modify: `src/kernel/context.ts` — resolve override before file; add `invalidateAppContext()`.
- Create: `src/kernel/context.test.ts` — override-wins + reload behavior.
- Modify: `src/app/(admin)/_components/sidebar.tsx` — add `Settings` nav entry + `settings` icon.
- Create: `src/app/(admin)/settings/form-parse.ts` — pure `FormData → NewsletterConfig | errors` (testable core).
- Create: `src/app/(admin)/settings/form-parse.test.ts` — unit tests for parsing/validation.
- Create: `src/app/(admin)/settings/actions.ts` — `saveSettings` + `revertToFileDefault` server actions.
- Create: `src/app/(admin)/settings/SettingsForm.tsx` — client form using `useActionState`.
- Create: `src/app/(admin)/settings/fields.tsx` — shared input primitives (client).
- Create: `src/app/(admin)/settings/page.tsx` — server component page.
- Create: `e2e/settings.spec.ts` — Playwright flow.

---

## Task 1: `config_overrides` table + migration

**Files:**
- Modify: `src/kernel/db/schema.ts`
- Create: `drizzle/0003_config_overrides.sql` (generated)
- Test: `src/kernel/db/migrate.test.ts` (extend)

- [ ] **Step 1: Add the table to the schema**

Append to `src/kernel/db/schema.ts`:

```typescript
export const configOverrides = sqliteTable('config_overrides', {
  id: integer('id').primaryKey(), // always 1 — single row
  value: text('value').notNull(), // JSON of the full newsletter config
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate --name config_overrides`
Expected: creates `drizzle/0003_config_overrides.sql` containing `CREATE TABLE \`config_overrides\`` and updates `drizzle/meta/_journal.json`.

- [ ] **Step 3: Verify the SQL**

Run: `cat drizzle/0003_config_overrides.sql`
Expected: a `CREATE TABLE \`config_overrides\` (\`id\` integer PRIMARY KEY ..., \`value\` text NOT NULL, \`updated_at\` integer NOT NULL);` statement. If `drizzle-kit` is unavailable, hand-write that file and add an entry to `drizzle/meta/_journal.json` mirroring the existing entries (idx 3, the new tag).

- [ ] **Step 4: Write the failing migration test**

Add to `src/kernel/db/migrate.test.ts`:

```typescript
it('creates the config_overrides table', () => {
  const db = createDb(':memory:');
  applyMigrations(db);
  const cols = db.$client.prepare("PRAGMA table_info('config_overrides')").all() as { name: string }[];
  expect(cols.map(c => c.name)).toEqual(expect.arrayContaining(['id', 'value', 'updated_at']));
});
```

- [ ] **Step 5: Run the test**

Run: `npm test -- src/kernel/db/migrate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/kernel/db/schema.ts drizzle/0003_config_overrides.sql drizzle/meta/_journal.json src/kernel/db/migrate.test.ts
git commit -m "feat(settings): add config_overrides table"
```

---

## Task 2: Config override repository

**Files:**
- Create: `src/kernel/config/overrides.ts`
- Test: `src/kernel/config/overrides.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/kernel/config/overrides.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { readConfigOverride, writeConfigOverride, clearConfigOverride } from './overrides';
import { NewsletterConfigSchema } from './schema';

function freshDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

const sample = NewsletterConfigSchema.parse({
  from: { email: 'a@b.com', name: 'A' },
  schedule: '0 8 * * MON',
});

describe('config overrides', () => {
  it('returns null when no override exists', () => {
    expect(readConfigOverride(freshDb())).toBeNull();
  });

  it('round-trips a written override', () => {
    const db = freshDb();
    writeConfigOverride(db, sample);
    const got = readConfigOverride(db);
    expect(got?.schedule).toBe('0 8 * * MON');
    expect(got?.from.email).toBe('a@b.com');
  });

  it('overwrites the single row on repeated writes', () => {
    const db = freshDb();
    writeConfigOverride(db, sample);
    writeConfigOverride(db, { ...sample, schedule: '0 9 * * SUN' });
    expect(readConfigOverride(db)?.schedule).toBe('0 9 * * SUN');
    const count = db.$client.prepare('SELECT COUNT(*) as n FROM config_overrides').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('returns null and does not throw on invalid stored JSON', () => {
    const db = freshDb();
    db.$client.prepare('INSERT INTO config_overrides (id, value, updated_at) VALUES (1, ?, ?)')
      .run('{ not valid json', Date.now());
    expect(readConfigOverride(db)).toBeNull();
  });

  it('clear removes the row', () => {
    const db = freshDb();
    writeConfigOverride(db, sample);
    clearConfigOverride(db);
    expect(readConfigOverride(db)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/kernel/config/overrides.test.ts`
Expected: FAIL — `overrides.ts` module not found.

- [ ] **Step 3: Implement the repository**

Create `src/kernel/config/overrides.ts`:

```typescript
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import { configOverrides } from '@/kernel/db/schema';
import { NewsletterConfigSchema, type NewsletterConfig } from './schema';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('config.overrides');
const ROW_ID = 1;

export function readConfigOverride(db: Db): NewsletterConfig | null {
  const row = db.select().from(configOverrides).where(eq(configOverrides.id, ROW_ID)).get();
  if (!row) return null;
  try {
    const parsed = NewsletterConfigSchema.safeParse(JSON.parse(row.value));
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, 'stored config override failed validation; using file config');
      return null;
    }
    return parsed.data;
  } catch (err) {
    log.warn({ err }, 'stored config override is not valid JSON; using file config');
    return null;
  }
}

export function writeConfigOverride(db: Db, config: NewsletterConfig): void {
  const value = JSON.stringify(config);
  const updatedAt = new Date();
  db.insert(configOverrides)
    .values({ id: ROW_ID, value, updatedAt })
    .onConflictDoUpdate({ target: configOverrides.id, set: { value, updatedAt } })
    .run();
}

export function clearConfigOverride(db: Db): void {
  db.delete(configOverrides).where(eq(configOverrides.id, ROW_ID)).run();
}
```

> Note: `db.select().…get()` and `.run()` are the better-sqlite3 sync Drizzle methods used elsewhere in this codebase (see `src/kernel/db/migrate.test.ts`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/kernel/config/overrides.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/kernel/config/overrides.ts src/kernel/config/overrides.test.ts
git commit -m "feat(settings): config override repository"
```

---

## Task 3: Context resolution + hot reload

**Files:**
- Modify: `src/kernel/context.ts`
- Test: `src/kernel/context.test.ts`

- [ ] **Step 1: Update `getAppContext` to resolve the override + add `invalidateAppContext`**

Replace the body of `src/kernel/context.ts` `getAppContext()` and the trailing reset function with:

```typescript
import { readConfigOverride } from './config/overrides';
// ...existing imports unchanged...

export function getAppContext(): AppContext {
  if (cached) return cached;
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  applyMigrations(db);
  if (env.AUTH_MODE === 'session' && env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    import('./auth/bootstrap').then(({ bootstrapAdminUser }) =>
      bootstrapAdminUser(db, { email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! })
    ).catch(err => createLogger('context').error({ err }, 'admin bootstrap failed'));
  }
  const newsletter = readConfigOverride(db) ?? loadYamlConfig(env.CONFIG_PATH).newsletter;
  const config: YamlConfig = { newsletter };
  const tautulli = createTautulliClient({ url: env.TAUTULLI_URL, apiKey: env.TAUTULLI_API_KEY });
  const tmdb = createTmdbClient({ apiKey: env.TMDB_API_KEY });
  const email = createEmailProvider(env, config.newsletter.email);
  const llm = resolveLlmClient(env, config.newsletter);
  const scheduler = createScheduler();
  cached = { env, config, db, tautulli, tmdb, email, llm, scheduler };
  return cached;
}

// Reload the singleton in-process. Only correct because the Nomad job runs count=1
// (no second replica holds a stale cache). Stops old cron timers before rebuilding,
// then re-registers modules so the scheduler reflects new schedule/timezone/enabled.
export async function invalidateAppContext(): Promise<void> {
  if (cached) cached.scheduler.stopAll();
  cached = null;
  getAppContext();
  const { registerAllModules } = await import('@/modules'); // lazy: avoid circular import
  registerAllModules();
}

export function resetAppContextForTests() {
  if (cached) cached.scheduler.stopAll();
  cached = null;
}
```

> Note: `loadYamlConfig` returns the full `{ newsletter }` envelope, so read `.newsletter` from it. The lazy `import('@/modules')` breaks the `context → modules → context` cycle.

- [ ] **Step 2: Write the failing test**

Create `src/kernel/context.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAppContext, invalidateAppContext, resetAppContextForTests } from './context';
import { writeConfigOverride } from './config/overrides';
import { NewsletterConfigSchema } from './config/schema';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tortuga-ctx-'));
  writeFileSync(
    join(dir, 'tortuga.yml'),
    'newsletter:\n  from:\n    email: file@example.com\n    name: File\n  schedule: "0 9 * * SUN"\n',
  );
  process.env.TAUTULLI_URL = 'http://localhost:8181';
  process.env.TAUTULLI_API_KEY = 'x';
  process.env.TMDB_API_KEY = 'x';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'x'.repeat(32);
  process.env.AUTH_MODE = 'forward';
  process.env.DATABASE_URL = `file:${join(dir, 'tortuga.db')}`;
  process.env.CONFIG_PATH = join(dir, 'tortuga.yml');
  resetAppContextForTests();
});

afterEach(() => {
  resetAppContextForTests();
  rmSync(dir, { recursive: true, force: true });
});

describe('getAppContext config resolution', () => {
  it('uses the file config when no override exists', () => {
    expect(getAppContext().config.newsletter.from.email).toBe('file@example.com');
  });

  it('prefers a DB override over the file after invalidate', async () => {
    const override = NewsletterConfigSchema.parse({
      from: { email: 'override@example.com', name: 'Override' },
      schedule: '30 7 * * MON',
    });
    writeConfigOverride(getAppContext().db, override);
    await invalidateAppContext();
    const ctx = getAppContext();
    expect(ctx.config.newsletter.from.email).toBe('override@example.com');
    expect(ctx.config.newsletter.schedule).toBe('30 7 * * MON');
  });

  it('re-registers exactly one cron job reflecting the new schedule', async () => {
    await invalidateAppContext();
    const jobs = getAppContext().scheduler.list();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe('newsletter.digest');
  });

  it('registers no cron when schedule_enabled is false', async () => {
    const override = NewsletterConfigSchema.parse({
      from: { email: 'a@b.com', name: 'A' },
      schedule_enabled: false,
    });
    writeConfigOverride(getAppContext().db, override);
    await invalidateAppContext();
    expect(getAppContext().scheduler.list()).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/kernel/context.test.ts`
Expected: FAIL initially if `invalidateAppContext` not yet exported / behavior wrong. (After Step 1 it should pass — if it fails, fix `context.ts` until green.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/kernel/context.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite (guard against regressions in context callers)**

Run: `npm test`
Expected: PASS (all existing suites still green).

- [ ] **Step 6: Commit**

```bash
git add src/kernel/context.ts src/kernel/context.test.ts
git commit -m "feat(settings): resolve config override + invalidateAppContext hot reload"
```

---

## Task 4: Sidebar nav entry

**Files:**
- Modify: `src/app/(admin)/_components/sidebar.tsx`

- [ ] **Step 1: Add `settings` to the icon union and a nav item**

In `src/app/(admin)/_components/sidebar.tsx`, change the `NavItem` icon type:

```typescript
  icon: 'dashboard' | 'mail' | 'eye' | 'history' | 'users' | 'settings';
```

Append to the `items` array (after `recipients`):

```typescript
  { href: '/settings', label: 'Settings', exact: true, icon: 'settings' },
```

- [ ] **Step 2: Add the `settings` case to the `Icon` switch**

Before the closing `}` of the `switch (name)` in `Icon`, add:

```tsx
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
```

> The `items.slice(1)` grouping in `Sidebar` already renders every item after Dashboard under the "Newsletter" header; the Settings link will appear there. That is acceptable for v1.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/_components/sidebar.tsx"
git commit -m "feat(settings): add Settings sidebar nav entry"
```

---

## Task 5: FormData parsing + validation (pure core)

**Files:**
- Create: `src/app/(admin)/settings/form-parse.ts`
- Test: `src/app/(admin)/settings/form-parse.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/(admin)/settings/form-parse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseNewsletterForm } from './form-parse';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const base = {
  schedule: '0 9 * * SUN',
  timezone: 'America/New_York',
  schedule_enabled: 'on',
  lookback_days: '7',
  'email.provider': 'resend',
  'from.email': 'newsletter@example.com',
  'from.name': 'Orpheus',
  'filters.min_tmdb_rating': '6',
  'filters.dedupe_episodes_into_seasons': 'on',
  'filters.max_items_per_section': '12',
  'filters.exclude_genres': '',
  'commentary.enabled': '',
  'commentary.provider': 'anthropic',
  'commentary.model': '',
  'commentary.voice': '',
};

describe('parseNewsletterForm', () => {
  it('parses a valid form into a NewsletterConfig', () => {
    const r = parseNewsletterForm(fd(base));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.schedule).toBe('0 9 * * SUN');
      expect(r.config.schedule_enabled).toBe(true);
      expect(r.config.lookback_days).toBe(7);
      expect(r.config.filters.min_tmdb_rating).toBe(6);
    }
  });

  it('treats an absent checkbox as false', () => {
    const r = parseNewsletterForm(fd({ ...base, schedule_enabled: '' }));
    expect(r.ok && r.config.schedule_enabled).toBe(false);
  });

  it('splits comma/newline lists and drops blanks', () => {
    const r = parseNewsletterForm(fd({ ...base, 'filters.exclude_genres': 'Horror, Reality\nNews' }));
    expect(r.ok && r.config.filters.exclude_genres).toEqual(['Horror', 'Reality', 'News']);
  });

  it('maps empty include_libraries to null (all libraries)', () => {
    const r = parseNewsletterForm(fd({ ...base, include_libraries: '' }));
    expect(r.ok && r.config.include_libraries).toBeNull();
  });

  it('omits optional extras when blank', () => {
    const r = parseNewsletterForm(fd(base));
    expect(r.ok && r.config.extras).toBeUndefined();
  });

  it('returns field errors for an invalid email', () => {
    const r = parseNewsletterForm(fd({ ...base, 'from.email': 'not-an-email' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['from.email']).toBeTruthy();
  });

  it('requires mailgun domain when provider is mailgun', () => {
    const r = parseNewsletterForm(fd({ ...base, 'email.provider': 'mailgun', 'email.mailgun.domain': '' }));
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- "src/app/(admin)/settings/form-parse.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

Create `src/app/(admin)/settings/form-parse.ts`:

```typescript
import { NewsletterConfigSchema, type NewsletterConfig } from '@/kernel/config/schema';

export type ParseResult =
  | { ok: true; config: NewsletterConfig }
  | { ok: false; errors: Record<string, string> };

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === 'on';
}
function num(fd: FormData, key: string): number {
  return Number(str(fd, key));
}
function list(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);
}
function opt(value: string): string | undefined {
  return value === '' ? undefined : value;
}

export function parseNewsletterForm(fd: FormData): ParseResult {
  const provider = str(fd, 'email.provider') === 'mailgun' ? 'mailgun' : 'resend';
  const includeRaw = list(fd, 'include_libraries');

  const extrasFields = {
    request_url: opt(str(fd, 'extras.request_url')),
    request_label: str(fd, 'extras.request_label'),
    personal_url: opt(str(fd, 'extras.personal_url')),
    personal_label: opt(str(fd, 'extras.personal_label')),
    freeform_markdown: opt(str(fd, 'extras.freeform_markdown')),
  };
  const hasExtras =
    extrasFields.request_url !== undefined ||
    extrasFields.personal_url !== undefined ||
    extrasFields.personal_label !== undefined ||
    extrasFields.freeform_markdown !== undefined ||
    (extrasFields.request_label !== '' && extrasFields.request_label !== 'Request a title');

  const candidate = {
    schedule: str(fd, 'schedule'),
    schedule_enabled: bool(fd, 'schedule_enabled'),
    timezone: str(fd, 'timezone'),
    lookback_days: num(fd, 'lookback_days'),
    email: {
      provider,
      ...(provider === 'mailgun'
        ? { mailgun: { domain: str(fd, 'email.mailgun.domain'), region: str(fd, 'email.mailgun.region') === 'eu' ? 'eu' : 'us' } }
        : {}),
    },
    from: { email: str(fd, 'from.email'), name: str(fd, 'from.name') },
    reply_to: opt(str(fd, 'reply_to')),
    include_libraries: includeRaw.length ? includeRaw : null,
    filters: {
      min_tmdb_rating: num(fd, 'filters.min_tmdb_rating'),
      dedupe_episodes_into_seasons: bool(fd, 'filters.dedupe_episodes_into_seasons'),
      max_items_per_section: num(fd, 'filters.max_items_per_section'),
      exclude_genres: list(fd, 'filters.exclude_genres'),
    },
    featured: { enabled: bool(fd, 'featured.enabled') },
    ...(str(fd, 'plex.server_id') ? { plex: { server_id: str(fd, 'plex.server_id') } } : {}),
    commentary: {
      enabled: bool(fd, 'commentary.enabled'),
      provider: str(fd, 'commentary.provider') === 'openai' ? 'openai' : 'anthropic',
      model: str(fd, 'commentary.model'),
      voice: str(fd, 'commentary.voice'),
    },
    ...(hasExtras ? { extras: extrasFields } : {}),
  };

  const parsed = NewsletterConfigSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, config: parsed.data };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return { ok: false, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "src/app/(admin)/settings/form-parse.test.ts"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/settings/form-parse.ts" "src/app/(admin)/settings/form-parse.test.ts"
git commit -m "feat(settings): FormData → NewsletterConfig parser with validation"
```

---

## Task 6: Server actions

**Files:**
- Create: `src/app/(admin)/settings/actions.ts`

- [ ] **Step 1: Implement the actions**

Create `src/app/(admin)/settings/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { writeConfigOverride, clearConfigOverride } from '@/kernel/config/overrides';
import { parseNewsletterForm } from './form-parse';

export type SaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errors: Record<string, string> };

export async function saveSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const result = parseNewsletterForm(formData);
  if (!result.ok) return { status: 'error', errors: result.errors };

  const ctx = getAppContext();
  writeConfigOverride(ctx.db, result.config);
  await invalidateAppContext();

  revalidatePath('/settings');
  revalidatePath('/');
  return { status: 'success' };
}

export async function revertToFileDefault(): Promise<void> {
  const ctx = getAppContext();
  clearConfigOverride(ctx.db);
  await invalidateAppContext();
  revalidatePath('/settings');
  revalidatePath('/');
}
```

> Validation happens before any write, so a persisted override is always loadable by `getAppContext()` — the rebuild inside `invalidateAppContext` cannot crash on bad config.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/settings/actions.ts"
git commit -m "feat(settings): save + revert server actions"
```

---

## Task 7: Field primitives + settings form (client)

**Files:**
- Create: `src/app/(admin)/settings/fields.tsx`
- Create: `src/app/(admin)/settings/SettingsForm.tsx`

- [ ] **Step 1: Create the field primitives**

Create `src/app/(admin)/settings/fields.tsx`:

```tsx
'use client';

import * as React from 'react';

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

function Wrap({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-[11.5px] text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-[11.5px] text-danger">{error}</span> : null}
    </label>
  );
}

export function TextField({ name, label, defaultValue = '', hint, error, type = 'text', placeholder }: {
  name: string; label: string; defaultValue?: string; hint?: string; error?: string; type?: string; placeholder?: string;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input className={inputCls} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </Wrap>
  );
}

export function NumberField({ name, label, defaultValue, hint, error, step, min, max }: {
  name: string; label: string; defaultValue: number; hint?: string; error?: string; step?: string; min?: number; max?: number;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input className={inputCls} name={name} type="number" defaultValue={defaultValue} step={step} min={min} max={max} />
    </Wrap>
  );
}

export function TextareaField({ name, label, defaultValue = '', hint, error, rows = 3 }: {
  name: string; label: string; defaultValue?: string; hint?: string; error?: string; rows?: number;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <textarea className={inputCls} name={name} defaultValue={defaultValue} rows={rows} />
    </Wrap>
  );
}

export function SelectField({ name, label, defaultValue, options, hint, error }: {
  name: string; label: string; defaultValue: string; options: ReadonlyArray<{ value: string; label: string }>; hint?: string; error?: string;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <select className={inputCls} name={name} defaultValue={defaultValue}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}

export function CheckboxField({ name, label, defaultChecked, hint }: {
  name: string; label: string; defaultChecked: boolean; hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 py-1">
      <input className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent-gold" name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span>
        <span className="block text-[13.5px] text-fg">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
```

- [ ] **Step 2: Create the form**

Create `src/app/(admin)/settings/SettingsForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { Button, Card, CardHeader } from '../_components/ui';
import { saveSettings, type SaveState } from './actions';
import { TextField, NumberField, TextareaField, SelectField, CheckboxField } from './fields';

const initial: SaveState = { status: 'idle' };

export function SettingsForm({ config }: { config: NewsletterConfig }) {
  const [state, action, pending] = useActionState(saveSettings, initial);
  const err = state.status === 'error' ? state.errors : {};

  return (
    <form action={action} className="grid gap-5">
      <Card>
        <CardHeader title="Schedule" description="When the digest is generated and sent." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="schedule" label="Cron" defaultValue={config.schedule} error={err['schedule']} hint="e.g. 0 9 * * SUN" />
          <TextField name="timezone" label="Timezone" defaultValue={config.timezone} error={err['timezone']} />
          <NumberField name="lookback_days" label="Lookback days" defaultValue={config.lookback_days} min={1} error={err['lookback_days']} />
        </div>
        <div className="mt-2">
          <CheckboxField name="schedule_enabled" label="Scheduled sends enabled" defaultChecked={config.schedule_enabled} hint="Off pauses the cron without losing settings." />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sender & Email" description="Identity and delivery provider." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="from.email" label="From email" type="email" defaultValue={config.from.email} error={err['from.email']} />
          <TextField name="from.name" label="From name" defaultValue={config.from.name} error={err['from.name']} />
          <TextField name="reply_to" label="Reply-to (optional)" type="email" defaultValue={config.reply_to ?? ''} error={err['reply_to']} />
          <SelectField name="email.provider" label="Provider" defaultValue={config.email.provider}
            options={[{ value: 'resend', label: 'Resend' }, { value: 'mailgun', label: 'Mailgun' }]} />
          <TextField name="email.mailgun.domain" label="Mailgun domain" defaultValue={config.email.mailgun?.domain ?? ''} error={err['email.mailgun.domain']} hint="Required when provider is Mailgun." />
          <SelectField name="email.mailgun.region" label="Mailgun region" defaultValue={config.email.mailgun?.region ?? 'us'}
            options={[{ value: 'us', label: 'US' }, { value: 'eu', label: 'EU' }]} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Filters" description="What content makes it into the digest." />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField name="filters.min_tmdb_rating" label="Min TMDB rating" defaultValue={config.filters.min_tmdb_rating} step="0.1" min={0} max={10} error={err['filters.min_tmdb_rating']} />
          <NumberField name="filters.max_items_per_section" label="Max items per section" defaultValue={config.filters.max_items_per_section} min={1} error={err['filters.max_items_per_section']} />
          <TextField name="filters.exclude_genres" label="Exclude genres" defaultValue={config.filters.exclude_genres.join(', ')} hint="Comma or newline separated." />
          <TextField name="include_libraries" label="Include libraries" defaultValue={(config.include_libraries ?? []).join(', ')} hint="Blank = all libraries." />
        </div>
        <div className="mt-2">
          <CheckboxField name="filters.dedupe_episodes_into_seasons" label="Group episodes into seasons" defaultChecked={config.filters.dedupe_episodes_into_seasons} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Commentary" description="AI-generated editorial intro." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="commentary.provider" label="Provider" defaultValue={config.commentary.provider}
            options={[{ value: 'anthropic', label: 'Anthropic' }, { value: 'openai', label: 'OpenAI' }]} />
          <TextField name="commentary.model" label="Model (optional)" defaultValue={config.commentary.model} hint="Blank uses the provider default." />
        </div>
        <div className="mt-2"><CheckboxField name="commentary.enabled" label="Enable AI intro" defaultChecked={config.commentary.enabled} /></div>
        <div className="mt-4"><TextareaField name="commentary.voice" label="Voice" defaultValue={config.commentary.voice} rows={3} hint="Freeform tone instructions." /></div>
      </Card>

      <Card>
        <CardHeader title="Extras" description="Optional footer links and notes." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="extras.request_url" label="Request URL" type="url" defaultValue={config.extras?.request_url ?? ''} error={err['extras.request_url']} />
          <TextField name="extras.request_label" label="Request label" defaultValue={config.extras?.request_label ?? 'Request a title'} />
          <TextField name="extras.personal_url" label="Personal URL" type="url" defaultValue={config.extras?.personal_url ?? ''} error={err['extras.personal_url']} />
          <TextField name="extras.personal_label" label="Personal label" defaultValue={config.extras?.personal_label ?? ''} />
        </div>
        <div className="mt-4"><TextareaField name="extras.freeform_markdown" label="Footer note" defaultValue={config.extras?.freeform_markdown ?? ''} rows={2} /></div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
        {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
        {state.status === 'error' ? <span className="text-[13px] text-danger">Fix the highlighted fields.</span> : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/settings/fields.tsx" "src/app/(admin)/settings/SettingsForm.tsx"
git commit -m "feat(settings): settings form + field primitives"
```

---

## Task 8: Settings page

**Files:**
- Create: `src/app/(admin)/settings/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(admin)/settings/page.tsx`:

```tsx
import { getAppContext } from '@/kernel/context';
import { revertToFileDefault } from './actions';
import { SettingsForm } from './SettingsForm';
import { Badge, Button, Card, CardHeader, PageHeader } from '../_components/ui';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const ctx = getAppContext();
  const cfg = ctx.config.newsletter;
  const env = ctx.env;

  const secrets: Array<{ label: string; set: boolean }> = [
    { label: 'Resend API key', set: Boolean(env.RESEND_API_KEY) },
    { label: 'Mailgun API key', set: Boolean(env.MAILGUN_API_KEY) },
    { label: 'Anthropic API key', set: Boolean(env.ANTHROPIC_API_KEY) },
    { label: 'OpenAI API key', set: Boolean(env.OPENAI_API_KEY) },
    { label: 'TMDB API key', set: Boolean(env.TMDB_API_KEY) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Newsletter configuration"
        description="Changes are saved to this instance and applied immediately — no restart needed."
        actions={
          <form action={revertToFileDefault}>
            <Button type="submit" variant="ghost">Revert to file default</Button>
          </form>
        }
      />

      <SettingsForm config={cfg} />

      <div className="mt-6">
        <Card>
          <CardHeader title="Provider status" description="Secrets are managed in Vault and shown read-only here." />
          <ul className="grid gap-2 sm:grid-cols-2">
            {secrets.map(s => (
              <li key={s.label} className="flex items-center justify-between rounded-md bg-elevated/50 px-3 py-2">
                <span className="text-[13px] text-muted">{s.label}</span>
                <Badge tone={s.set ? 'success' : 'neutral'} dot>{s.set ? 'Set' : 'Not set'}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; `/settings` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/settings/page.tsx"
git commit -m "feat(settings): settings page with form + provider status"
```

---

## Task 9: E2E test

**Files:**
- Create: `e2e/settings.spec.ts`

> Check `playwright.config.ts` for `baseURL` and any auth/storage-state setup used by existing specs in `e2e/`. The app runs `AUTH_MODE=forward` in prod but defaults to `session` locally — match how existing e2e specs authenticate (reuse their login/storage-state helper). If existing specs hit pages directly under a configured baseURL with no auth, follow that.

- [ ] **Step 1: Write the spec**

Create `e2e/settings.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('settings page edits and persists config', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Newsletter configuration' })).toBeVisible();

  const lookback = page.locator('input[name="lookback_days"]');
  await lookback.fill('9');
  await page.getByRole('button', { name: /save settings/i }).click();

  await expect(page.getByText(/saved and reloaded/i)).toBeVisible();

  await page.reload();
  await expect(page.locator('input[name="lookback_days"]')).toHaveValue('9');
});
```

- [ ] **Step 2: Run the E2E test**

Run: `npm run e2e -- settings.spec.ts`
Expected: PASS. (If auth blocks it, wire the same auth setup the other `e2e/` specs use, then re-run.)

- [ ] **Step 3: Commit**

```bash
git add e2e/settings.spec.ts
git commit -m "test(settings): e2e edit + persist flow"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run the entire unit/integration suite**

Run: `npm test`
Expected: all suites green.

- [ ] **Step 2: Manual dev-server check**

Run: `npm run dev`, open `/settings`. Verify:
- Current config values are pre-filled.
- Edit `commentary.voice` and a filter, Save → "Saved and reloaded." appears, values persist on reload.
- Toggle `Scheduled sends enabled` off, Save; check logs show the cron not registered. Toggle on, Save; cron re-registers.
- Set provider to Mailgun with a blank domain → Save shows the domain field error and nothing persists.
- "Revert to file default" restores the `tortuga.yml` values.
- Provider status badges reflect which secrets are set.

- [ ] **Step 3: Final type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

---

## Self-Review Notes

- **Spec coverage:** persistence (Task 1–2), resolution + hot reload incl. scheduler re-register (Task 3), nav (Task 4), validation reuse (Task 5), save/revert + invalidate (Task 6), UI incl. read-only secret status (Task 7–8), testing unit/integration/e2e (Tasks 2,3,5,9), verification (Task 10). All spec sections mapped.
- **Deviation from spec:** spec mentioned optional per-section independent saves; this plan uses a single form + single save (YAGNI). Behavior is otherwise identical.
- **Type consistency:** `readConfigOverride/writeConfigOverride/clearConfigOverride`, `invalidateAppContext` (async), `parseNewsletterForm`/`ParseResult`, `saveSettings`/`SaveState`, and field components are named consistently across tasks.
