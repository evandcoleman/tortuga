# Settings UI — Design

**Date:** 2026-05-22
**Status:** Approved design, pending implementation plan

## Context

Today every newsletter config change requires editing `/config/tortuga.yml` on the
CSI volume and restarting the tortuga container. The goal is an in-app **Settings**
page (under the existing `(admin)` route group) that lets the operator edit the
newsletter configuration from the web UI, with changes taking effect immediately
(no restart).

Grounding facts confirmed during exploration:

- `/config` is a writable, persistent CSI volume (`single-node-writer`). Both
  `tortuga.yml` and `tortuga.db` (SQLite via Drizzle) live there; writes survive
  restarts.
- `getAppContext()` (`src/kernel/context.ts`) is a cached module-level singleton.
  `resetAppContextForTests()` clears the cache.
- The Nomad job runs `count = 1`, so an **in-process** reload is valid and
  sufficient — there is no second replica holding a stale cache.
- Cron is registered at boot: `src/instrumentation.ts → registerAllModules()
  (src/modules/index.ts) → registerNewsletterModule()` reads
  `schedule` / `timezone` / `schedule_enabled` from config. The scheduler
  (`src/kernel/scheduler/scheduler.ts`) exposes `stopAll()`.
- Secrets (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, etc.) are injected from **Vault**
  via consul-template into env vars — they are **not** in the YAML.

## Scope (v1)

**In scope:** Editing the full `newsletter` config block — schedule/timezone/
`schedule_enabled`, `lookback_days`, `filters`, `from`/`reply_to`, email provider,
`include_libraries`, `commentary`, `extras`. Changes hot-reload without a restart.

**Out of scope (v1):** Editing secrets/API keys. Secrets remain Vault/env-managed
and are surfaced **read-only** as "Set / Not set" so the operator can see provider
readiness (e.g. commentary requires an Anthropic/OpenAI key). Editing secrets is a
possible follow-up (would require either plaintext-on-volume storage or a Vault
write path — deliberately deferred).

## Approach: DB config-override + in-process hot reload

### 1. Persistence — `config_overrides` table

Add one Drizzle table on the existing `/config/tortuga.db`:

```
config_overrides:
  id         INTEGER PRIMARY KEY  (always 1 — single row)
  value      TEXT (JSON of the full newsletter config)
  updatedAt  INTEGER (timestamp_ms)
```

Semantics: once the UI saves, the override row is the **source of truth** and
`tortuga.yml` becomes the seed/bootstrap default (used only when no override row
exists). A "Revert to file default" action deletes the row, falling back to the
YAML. This avoids deep-merge ambiguity and YAML comment loss from rewriting the
file.

New repository module `src/kernel/config/overrides.ts`:
- `readConfigOverride(db): NewsletterConfig | null` — parse + validate stored JSON
  against `NewsletterConfigSchema`; on parse/validation failure log and return
  `null` (fall back to file) rather than crash.
- `writeConfigOverride(db, config: NewsletterConfig): void`
- `clearConfigOverride(db): void`

### 2. Effective config resolution — `context.ts`

Reorder `getAppContext()` so the DB is available before config is resolved:

```
loadEnv() → createDb() → applyMigrations()
  → effectiveConfig = readConfigOverride(db) ?? loadYamlConfig(env.CONFIG_PATH)
  → build tautulli / tmdb / email / llm from env + effectiveConfig
```

Wrap the resolved `newsletter` config back into the `YamlConfig` shape
(`{ newsletter }`) so `ctx.config` keeps its current type. Env handling is
unchanged (no secret overlay in v1).

### 3. Hot reload — `invalidateAppContext()`

Add to `context.ts` (and keep `resetAppContextForTests` as a thin alias for tests):

```
export function invalidateAppContext(): void {
  if (cached) cached.scheduler.stopAll();  // tear down old cron timers
  cached = null;
  getAppContext();                          // rebuild singleton
  registerAllModules();                     // re-register cron with new schedule
}
```

This must be idempotent and is only correct because `count = 1`. Document that
constraint in a comment. `registerNewsletterModule()` already early-returns when
`schedule_enabled === false`, and `stopAll()` clears prior timers, so toggling the
schedule on/off works across reloads without duplicate or orphaned crons.

> Note: `registerAllModules()` lives in `src/modules/index.ts`. Import it lazily
> inside `invalidateAppContext()` (dynamic import) to avoid a circular import
> between `context.ts` and the modules barrel.

### 4. Settings page + save path

New route `src/app/(admin)/settings/page.tsx` (server component, `dynamic =
'force-dynamic'`):
- Reads `getAppContext().config.newsletter` for current values and
  `getAppContext().env` to compute secret readiness flags.
- Renders sectioned `<Card>`s reusing `_components/ui.tsx` primitives
  (`PageHeader`, `Card`, `CardHeader`, `Button`, plus a shared `Field`/input set):
  **Schedule**, **Filters**, **Sender & Email**, **Commentary**, **Extras**,
  **Libraries**. A read-only **Provider status** area shows Set/Not-set for
  relevant secrets.

Forms are client components using React 19 `useActionState`, calling a server
action `saveSettings` for inline validation errors. Each section may save
independently (smaller blast radius) by submitting only its slice; the action
merges the slice over the current effective config, validates the **whole**
`NewsletterConfigSchema`, persists, and reloads.

Server action `src/app/(admin)/settings/actions.ts` (`'use server'`):
1. Build the candidate full config (current effective config + submitted slice).
2. Validate with `NewsletterConfigSchema.safeParse`; on failure return
   `{ ok: false, errors }` for inline display.
3. `writeConfigOverride(db, parsed)`.
4. `invalidateAppContext()`.
5. `revalidatePath('/settings')` and `revalidatePath('/')` (dashboard shows config-derived info).
6. Return `{ ok: true }`.

A separate `revertToFileDefault` action calls `clearConfigOverride` +
`invalidateAppContext`.

### 5. Navigation

Add a `Settings` entry to the sidebar nav array in
`src/app/(admin)/_components/sidebar.tsx` (route `/settings`, gear icon).

## Components / boundaries

- `src/kernel/config/overrides.ts` — read/write/clear override; pure data access
  over Drizzle. Independently testable.
- `context.ts` changes — resolution reorder + `invalidateAppContext`.
- `src/app/(admin)/settings/` — `page.tsx`, `actions.ts`, and client form
  components (one per section, or a shared `SettingsForm` taking a schema slice).
- Reuse existing Zod schemas (`NewsletterConfigSchema`) — no new validation logic.

## Error handling

- Override JSON that fails to parse/validate ⇒ log + fall back to file config
  (never crash the app on a bad row).
- Save validation failures ⇒ returned to the form, rendered inline; nothing
  persisted, no reload.
- `invalidateAppContext` rebuild failure (e.g. bad config somehow persisted) ⇒
  must not leave the app with no scheduler; rebuild happens via `getAppContext()`
  which throws on invalid config, so the save action validates **before** writing
  to guarantee the persisted value is always loadable.

## Testing

- **Unit** (`overrides.test.ts`): write→read round-trip; invalid JSON returns null;
  clear removes row.
- **Unit** (`context` reload): `invalidateAppContext` stops the old scheduler and
  re-registers cron; `scheduler.list()` reflects a changed `schedule`; disabling
  `schedule_enabled` leaves no registered job after reload.
- **Unit** (save action): valid slice persists + reloads; invalid slice returns
  errors and persists nothing.
- **Integration**: save changes `min_tmdb_rating`; a fresh `getAppContext()`
  reflects the new value; revert restores the file value.
- **E2E** (Playwright): navigate to `/settings`, change a field, save, assert the
  value persists on reload and the success state renders.

## Verification (end-to-end)

1. `npm test` (or project test runner) — all unit/integration suites green.
2. Run the dev server, open `/settings`, edit `lookback_days` and a commentary
   `voice`, save, confirm inline success and that values persist after a page
   reload.
3. Toggle `schedule_enabled` off then on; confirm via logs / `scheduler.list()`
   that the cron is removed then re-registered with the correct next run.
4. Confirm secrets render read-only (Set/Not set) and are never echoed.
5. "Revert to file default" restores `tortuga.yml` values.
