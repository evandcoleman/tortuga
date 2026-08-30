# Nav reorg, settings revamp, UI-configurable services

**Status:** draft
**Goal:** Sidebar gets real categories (Messages and Settings out of "Newsletter"); the settings page splits into organized sub-pages; external services (Tautulli, TMDB, Maintainerr, email provider, LLM) become configurable in the web UI, with env vars remaining a fully supported override.

## 1. Sidebar

`src/app/(admin)/_components/sidebar.tsx` becomes grouped sections with headers:

- **Workspace**: Dashboard (`/`)
- **Newsletter**: Overview (`/newsletter`), Preview, Customize, History, Recipients
- **Messages**: Compose (`/messages`), History (`/messages/history`)
- **Settings** (`/settings`) pinned at the bottom of the nav, above the user block

Route moves: `/newsletter/messages` → `/messages`, `/newsletter/messages/history/[id]` → `/messages/history/[id]`. Old paths issue permanent redirects (per current Next 16 docs — implementer reads `node_modules/next/dist/docs` first). All moved pages keep `requireAdminSession()` as the first statement of every action.

## 2. Settings sub-pages

`/settings` becomes a layout with its own sub-nav (second-level list, same visual language as the sidebar) and redirects to `/settings/general`. The single `SettingsForm` splits into one form + server action per page; each action validates with the existing zod config schema, writes `config_overrides`, and calls `invalidateAppContext()` (unchanged mechanics).

| Page | Contents (moved from current sections) |
|---|---|
| `/settings/general` | schedule cron, schedule_enabled, timezone, lookback_days, Plex server_id |
| `/settings/content` | filters (rating, max items, genres, libraries, dedupe), leaving-soon (enabled, days, heading, excluded collections checklist), commentary (enabled, provider, model, voice, disclaimer), extras (request/personal links, freeform markdown) |
| `/settings/email` | provider dropdown, from.email, from.name, reply_to, mailgun domain + region, **and** provider credentials: Resend API key + webhook secret, Mailgun API key + webhook signing key (service-settings fields, §3) |
| `/settings/services` | Tautulli (url, api key), TMDB (api key), Maintainerr (url), Anthropic API key, OpenAI API key — one card per service with its own Save and Test button |

Dropped from settings: the Appearance section (theme, layout) — the Customize page already owns both; settings links to it. The existing "Integration Tests" buttons are replaced by the per-card Test buttons.

## 3. Service settings (UI + env)

### Managed fields

`tautulli.url`, `tautulli.api_key`, `tmdb.api_key`, `maintainerr.url`, `resend.api_key`, `resend.webhook_secret`, `mailgun.api_key`, `mailgun.webhook_signing_key`, `anthropic.api_key`, `openai.api_key` — each mapped 1:1 to its existing env var.

Env-only, never in UI: `APP_URL`, `SESSION_SECRET`, `DATABASE_URL`, `AUTH_*`, `ADMIN_*`, `DIGEST_RUN_TOKEN`, `LOG_LEVEL`, `CONFIG_PATH`.

### Precedence

**Env always wins.** Effective value = env var if set, else DB value, else unset. When the env var is set, the UI field is disabled and annotated "Set via `TAUTULLI_API_KEY`" (a DB value may still exist underneath but is inert and not shown). No changes to the Nomad job; removing an env var there is how a field becomes UI-managed.

### Storage

New table `service_settings` (drizzle migration via `drizzle-kit generate`): `key` TEXT PK (the field names above), `value` TEXT (encrypted), `updated_at`. **All** values encrypted at rest — AES-256-GCM, key = HKDF-SHA256(`SESSION_SECRET`, salt `"tortuga.service-settings"`, info `"v1"`), stored as base64 `iv‖tag‖ciphertext`. A value that fails to decrypt (rotated `SESSION_SECRET`) is treated as unset and logged once at warn.

New module `src/kernel/config/service-settings.ts`:

```ts
readServiceSettings(db, env): ResolvedServiceSettings
// per field: { value: string | undefined, source: 'env' | 'db' | undefined }
writeServiceSettings(db, patch: Partial<Record<Key, string | null>>): void  // null clears
```

### Context wiring

`getAppContext()` builds clients from resolved settings instead of raw env. `EnvSchema`: `TAUTULLI_URL`, `TAUTULLI_API_KEY`, `TMDB_API_KEY` become optional (URL fields get the same `'' → undefined` transform as `MAINTAINERR_URL`). `AppContext.tautulli`, `.tmdb`, `.email` become nullable like `maintainerr`/`llm` already are. Consumers check and fail with a typed `ServiceNotConfiguredError`:

- Digest run (scheduled or manual): fails fast, digest row status `failed` with error `"Tautulli is not configured"` (etc.) — never crashes the process.
- Announcement/digest send with no email provider: action returns the error to the UI; scheduled send records `failed`.
- Dashboard: unconfigured required services (Tautulli, TMDB, email) surface as a setup callout linking to the settings page.
- Webhook routes for a provider with no webhook secret configured: keep current behavior (reject).

Saving any service setting calls `invalidateAppContext()`.

### Secret field UX

- Stored (db) secret: masked placeholder “•••••••• saved”, blank submit = keep, typed value = replace, explicit Clear button = delete row. Secrets are never sent back to the client.
- Non-secret fields (urls) render their effective value normally.
- `source: 'env'` → disabled input + env-var note, no Save applies to that field.

### Test buttons

One server action per service (admin-gated): builds a throwaway client from the **effective** values and pings — Tautulli `get_server_info`, TMDB `/configuration`, Maintainerr `/api/collections`, Resend/Mailgun domain/key check, Anthropic/OpenAI models list. Returns ok or the error message; 5s timeout; never mutates state.

## Failure modes

| Failure | Behavior |
|---|---|
| Fresh install, nothing configured | App boots, dashboard shows setup callout, digest runs fail with clear message |
| `SESSION_SECRET` rotated | DB secrets unreadable → treated as unset, warn logged, UI shows fields empty |
| Env var and DB both set | Env used, UI disabled + note; DB value inert |
| Test button failure | Inline error on the card; nothing saved or invalidated |

## Tests (vitest)

- `service-settings.test.ts`: encrypt/decrypt round-trip; tamper → unset + warn; precedence env > db > unset; clear deletes; patch merges.
- `context` test: unconfigured tautulli → `AppContext.tautulli === null`; configured via db → client built; env beats db.
- Digest run test: no tautulli → digest row `failed`, message names the service, process healthy.
- Settings actions: each page's action rejects invalid input, requires admin, writes only its fields; secret keep/replace/clear semantics.
- Sidebar/redirect tests: old `/newsletter/messages*` paths redirect permanently.

## Out of scope

Auth/env bootstrap settings in UI, multi-user roles, Nomad job changes, YAML config removal (yaml still works as before for newsletter config).
