# Architecture

How Tortuga is put together: the kernel/modules split, request flow, config
layering, the scheduler, the data model, and the email provider abstraction.

## Kernel vs. modules

- **`src/kernel/`** — infrastructure shared by every feature: config loading
  (`config/`), the SQLite/Drizzle client and migrator (`db/`), auth
  (`auth/`), the email-provider abstraction (`email/`), external service
  clients (`integrations/` — Tautulli, TMDB, Maintainerr, Plex, LLM),
  scheduling (`scheduler/`), logging (`logging/`), and timezone helpers
  (`time/`). Kernel code doesn't know about "digests" or "invites" — it's
  generic plumbing.
- **`src/modules/`** — one directory per feature (`newsletter`,
  `announcements`, `templates`, `alerts`, `invites`, `portal`, `preferences`),
  each owning its own Drizzle schema (`schema.ts`), business logic, and
  (where relevant) a `module.ts` that registers scheduled jobs. Modules
  depend on the kernel, never on each other's internals directly — shared
  concerns (e.g. recipient delivery/suppression) live in the kernel
  (`kernel/email/deliver.ts`) instead.

## Module registration

`src/instrumentation.ts` is Next.js's `register()` hook, invoked once at
process startup in the Node.js runtime. It dynamically imports
`src/modules/index.ts`'s `registerAllModules()`, which calls each module's
`registerXModule()` function in turn (newsletter, announcements, templates,
alerts). Each of those pulls the singleton `AppContext` (see below) and
registers its cron job(s) with the shared scheduler.

## Request flow

`src/middleware.ts` runs (Node.js runtime, not Edge — it needs
`better-sqlite3`, a native module) on every request except `_next/` and
`favicon.ico`:

1. **Portal-host check** — if the request's `Host` header matches the
   configured `portal.domain`, the request is entirely rewritten to
   `/portal/*` and auth is bypassed (the portal domain is meant to be
   public). Any inbound forward-auth header is stripped first so a client
   can't forge admin identity on the public domain. See
   [Portal guide](../guide/portal.md).
2. **Public paths** — `/login`, `/api/healthz`, `/api/unsubscribe`,
   `/preferences`, the webhook routes, `/api/auth/*`, and `/issues/*` pass
   through unauthenticated on the admin host too.
3. **Auth mode** — everything else is gated by `AUTH_MODE`:
   - `forward`: middleware requires the configured header (default
     `Remote-User`) to be present; a missing header is a bare `401`. No
     built-in login.
   - `session` (default): middleware lets the request through; each admin
     route's layout independently calls NextAuth's `auth()` and redirects to
     `/login` if there's no session. Credentials auth
     (`src/kernel/auth/auth.ts`) verifies email/password against Argon2id
     hashes in the `users` table.

## Config layering

Precedence, highest to lowest:

1. **Environment variables** — service credentials (Tautulli/TMDB/Resend/etc.)
   set via env always win over anything stored in the database
   (`src/kernel/config/service-settings.ts`; see `SERVICE_SETTING_KEYS`).
2. **DB config overrides** — the `newsletter` and `portal` sections of the
   admin UI save a full JSON blob into `config_overrides` (one row per
   section), read back via `readConfigOverride()`
   (`src/kernel/config/overrides.ts`). A stored override that fails schema
   validation is discarded (logged, falls through) rather than crashing.
3. **`tortuga.yml`** — the file at `CONFIG_PATH`, used whenever no DB
   override exists for that section.
4. **Schema defaults** — Zod defaults on individual fields (see
   `NewsletterConfigSchema`/`PortalConfigSchema` in
   `src/kernel/config/schema.ts`).

Non-secret service settings (URLs, non-key config) can also be stored in the
DB and are similarly overridden by env when present. Secret service settings
stored in the DB are encrypted at rest with a key derived (HKDF) from
`SESSION_SECRET` — see `src/kernel/config/service-settings.ts`.

## Application context

`getAppContext()` (`src/kernel/context.ts`) builds one process-wide singleton
holding the resolved env, config, DB handle, every integration client
(nullable — `null` means "not configured"), the scheduler, and the resolved
portal config. It's cached in a module-level variable, which is only correct
because Tortuga is deployed as a single instance (Nomad job `count = 1`) —
there is no cross-instance cache invalidation. Saving newsletter/portal
settings in the admin UI calls `invalidateAppContext()`, which stops every
running cron job, clears the cache, rebuilds it, and re-registers modules so
schedule/timezone/enabled changes take effect without a process restart. If
the rebuild itself throws, the prior context is restored so the app keeps
running on the old config rather than crashing.

## Scheduler

`src/kernel/scheduler/scheduler.ts` wraps [croner](https://github.com/Hexagon/croner).
`register()` takes a name, cron expression, timezone, and async handler;
duplicate names throw. Each job's `protect` option skips a tick if the
previous run of that same job is still in progress (prevents overlapping
digest sends on a slow run). A handler's thrown error is logged and passed
to any registered `onError` listener — the alerts module uses this to turn
any job's uncaught throw into a `scheduler_error` alert (see
[Alerts](../guide/alerts.md)) without every module needing its own
try/catch-and-alert logic.

Registered jobs: `newsletter.digest` (only if `schedule_enabled`),
`announcements.scheduled` (every minute, unconditional), `alerts.sweep`
(every minute, unconditional).

## Data model overview

SQLite via `better-sqlite3` + Drizzle ORM. Schemas are split across
`src/kernel/db/schema.ts` (kernel: `users`, `sessions`, `config_overrides`,
`service_settings`) and one `schema.ts` per module:

- **`newsletter`** — `digests` (one row per run, with both email- and
  web-variant rendered HTML, status, slug), `sends` (per-recipient delivery
  attempt, linked to a digest or an announcement), `send_events` (raw
  provider webhook events), `recipients_cache` (synced-from-Tautulli +
  manual recipients, active flag, suppression reason), `items_cache`
  (TMDB-enriched item cache), `unsubscribes` (one-shot per-category tokens).
- **`announcements`** — `announcements` (subject/body/recipient snapshot,
  status, optional `scheduledAt`).
- **`templates`** — reusable subject/body templates plus a `template_seeds`
  table used to seed the built-in `welcome` template on first boot.
- **`invites`** — one row per email invited through Tortuga (section IDs,
  Plex invite timestamp, welcome-email timestamp, status).
- **`alerts`** — one row per (kind, key), acknowledged/emailed state.
- **`recipient_preferences`** — per-recipient category opt-in flags and an
  optional library allow-list.

Foreign keys generally reference `digests`/`announcements`/`sends` by id;
`src/kernel/db/migrate.ts` temporarily disables FK enforcement around table
rebuild migrations (SQLite's pattern for e.g. nullability changes) and
verifies no dangling references were introduced afterward.

## Email provider abstraction

`src/kernel/email/types.ts` defines a provider-agnostic `EmailProvider`
interface (`send`, `verifyWebhook`, `parseEvent`) implemented by
`ResendProvider` and `MailgunProvider`. `createEmailProvider()`
(`src/kernel/email/factory.ts`) picks one based on `newsletter.email.provider`
and returns `null` (never throws) if that provider's credentials are
incomplete — callers treat a `null` provider as "email is not configured"
rather than crashing app boot. `deliverToRecipients()`
(`src/kernel/email/deliver.ts`) is the shared per-recipient send loop used by
both the newsletter and announcements pipelines: it resolves each
recipient's category preference, mints unsubscribe/preferences links, and
records a `sends` row per attempt.

## Next.js 16 notes

This repo pins Next.js `16.2.6`, which has framework-level breaking changes
since earlier major versions. Per `AGENTS.md`, consult
`node_modules/next/dist/docs/` for current API/convention docs before
assuming training-data knowledge of Next.js still applies — this project
already relies on newer conventions like Node.js-runtime middleware (stable
since 15.5) instead of Edge-only middleware.

## Related

- [Development setup](./index.md)
- [Contributing](./contributing.md)
- [Configuration overview](../configuration/index.md)
