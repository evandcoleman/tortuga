# Configuration

Tortuga is configured from three layers, resolved in this order (highest precedence first):

1. **Environment variables** — service secrets (API keys, webhook signing keys, tokens) and a
   handful of boot-time settings (`APP_URL`, `SESSION_SECRET`, `AUTH_MODE`, `DATABASE_URL`,
   `CONFIG_PATH`, ...). Always wins for the fields it covers. See [environment.md](./environment.md).
2. **Database overrides** — the `newsletter` and `portal` sections of `tortuga.yml`, when edited
   and saved from the admin **Settings** UI, are written whole to the `config_overrides` table
   (one JSON row per section, keyed `newsletter` / `portal`) and take over from the YAML file for
   that section.
3. **`tortuga.yml`** — the file on disk, read once at boot from `CONFIG_PATH` (default
   `/config/tortuga.yml`). Used only for a section that has no DB override yet.

## How this is implemented

`getAppContext()` (`src/kernel/context.ts:41-42`) resolves each section independently:

```ts
const newsletter = readConfigOverride(db, 'newsletter', NewsletterConfigSchema) ?? yamlConfig.newsletter;
const portalConfig = readConfigOverride(db, 'portal', PortalConfigSchema) ?? yamlConfig.portal;
```

`readConfigOverride` (`src/kernel/config/overrides.ts`) looks up the row for that section in
`config_overrides`; if present and it still validates against the current Zod schema, it is used
*in full* — there is no field-by-field merge with the YAML file. If the row is missing, invalid
JSON, or fails schema validation, Tortuga falls back to the YAML file's value for that section (and
logs a warning in the invalid/malformed cases).

This has one important consequence: **once you save a settings page in the admin UI, the whole
`newsletter` (or `portal`) section is pinned to the database.** Editing `tortuga.yml` after that
point has no effect on that section until the override is reverted — the file isn't even
re-diffed against the DB copy.

::: warning Editing tortuga.yml after using the Settings UI
If you've ever saved changes under **Settings**, further edits to `tortuga.yml` are silently
ignored for that section (`newsletter` or `portal`) until you revert. Check the "where is my
config" table below before troubleshooting a YAML change that "isn't taking".
:::

## Reverting to the file

**Settings → (danger zone) → Revert to file default** calls the `revertToFileDefault` server
action (`src/app/(admin)/settings/_lib/revert-action.ts`), which:

1. Requires an authenticated admin session.
2. Deletes the `newsletter` row from `config_overrides` (`clearConfigOverride(ctx.db, 'newsletter')`).
3. Invalidates the cached `AppContext` so the next request re-reads `tortuga.yml`.

This reverts **all** newsletter settings pages at once — there is no per-field or per-page revert.
The `portal` section has its own equivalent: `revertPortalSettings()`
(`src/app/(admin)/portal-settings/actions.ts`), wired to a "Revert to file default" button on the
**Portal** settings page (`PortalForm.tsx`).

## Service settings (API keys, tokens, URLs) are different

Eleven fields — Tautulli URL/key, TMDB key, Maintainerr URL, Resend key/webhook secret,
Mailgun key/webhook signing key, Anthropic/OpenAI keys, Plex token — are **service settings**, not part of the YAML-backed sections. They can be set
either via environment variable or via the admin **Settings** UI (which encrypts and stores them in
the `service_settings` table, keyed by AES-256-GCM with a key derived via HKDF from
`SESSION_SECRET`). `readServiceSettings()` (`src/kernel/config/service-settings.ts`) always prefers
the environment variable when it is set (non-empty); the DB value is used only when the
corresponding env var is empty or unset. See the full list in [environment.md](./environment.md).

If `SESSION_SECRET` is ever rotated, previously-encrypted DB values fail to decrypt and are treated
as unset (a single aggregated warning is logged) — re-enter them in the UI or set the env var.

## Where is my config?

| Setting | Source of truth | How to change it |
|---|---|---|
| `newsletter.*` (schedule, filters, from, theme, ...) before first UI save | `tortuga.yml` | Edit the file, restart |
| `newsletter.*` after any Settings save | `config_overrides` DB row `newsletter` | Settings UI, or revert to file |
| `portal.*` before first UI save | `tortuga.yml` | Edit the file, restart |
| `portal.*` after any Settings save | `config_overrides` DB row `portal` | Settings UI, or revert to file |
| Tautulli / TMDB / Maintainerr / Resend / Mailgun / Anthropic / OpenAI / Plex credentials | env var if set, else `service_settings` DB row | Env var (wins) or Settings UI |
| `APP_URL`, `SESSION_SECRET`, `AUTH_MODE`, `DATABASE_URL`, `CONFIG_PATH`, `LOG_LEVEL`, `DIGEST_RUN_TOKEN` | Environment only | Env var, restart |

## Related

- [Environment variables](./environment.md)
- [tortuga.yml reference](./tortuga-yml.md)
- [Portal configuration](./portal.md)
- [First run](../getting-started/first-run.md)
