# Tortuga — Design Spec

**Date:** 2026-05-12
**Status:** Approved for implementation planning
**Owner:** Evan Coleman

---

## Summary

Tortuga is a self-hosted Plex companion app focused on the **people and communication** layer — sending email to your Plex users, managing community lifecycle, and providing a single front-of-house surface for everything human-facing in a Plex server.

The v1 ships exactly one module: a **weekly newsletter** that replaces Tautulli's built-in newsletter with a custom-template, TMDB-enriched, filtered digest delivered via a transactional email service. Subsequent modules — one-off broadcasts, invites, user directory, re-engagement, curation tooling — slot into the same kernel without architectural changes.

Deploys as **a single Docker container**, matching the convention of the rest of the Plex ecosystem (Tautulli, Wizarr, Maintainerr, Decluttarr). No external database or queue required.

## Goals

1. **Replace Tautulli's newsletter** with something visually intentional, filtered, and TMDB-enriched.
2. **Ship a deployment story** that fits both a single-container `docker compose` use case and the deployment cluster's Nomad/Vault/Authelia pattern.
3. **Lay a foundation** for future modules (broadcasts, invites, user directory, re-engagement) without overbuilding for them now.
4. **Be honest about scope.** v1 = newsletter only, same digest for everyone, no per-user personalization. Future modules are anticipated but not designed.

## Non-goals (v1)

- Per-user personalization or recommendations
- Replacing Wizarr (invites stay in Wizarr for now)
- Replacing Tautulli (Tautulli stays for stats; only its newsletter feature is supplanted)
- Replacing dashboard tools like Homepage or Maintainerr
- Multi-tenant operation (single admin account)
- Postgres or Redis dependencies
- Plugin host abstraction (modules live as folders; formalization deferred until module 2 reveals the real interface)

## Architecture

Single Next.js 15 (App Router) application, `output: 'standalone'`, deployed as one Docker container.

```
                ┌──────────────────────────────────────────────┐
                │              tortuga container               │
                │                                              │
   ┌────────┐   │  ┌─────────────────────────────────────────┐ │
   │ user   │──▶│  │ Next.js (App Router, standalone output) │ │
   │ admin  │   │  │   ├─ /app/(admin)/*  — preview, send,   │ │
   │ UI     │   │  │   │   history, recipients               │ │
   └────────┘   │  │   ├─ /app/api/*      — digest runners,  │ │
                │  │   │   resend webhook, healthz           │ │
   ┌────────┐   │  │   └─ middleware       — auth gate       │ │
   │ cron / │──▶│  └─────────────────────────────────────────┘ │
   │ button │   │                  │                            │
   └────────┘   │                  ▼                            │
                │  ┌─────────────────────────────────────────┐ │
                │  │ digest pipeline (server-side)           │ │
                │  │   fetch → filter → render → send → log  │ │
                │  └─────────────────────────────────────────┘ │
                │           │           │            │          │
                │           ▼           ▼            ▼          │
                │      ┌────────┐ ┌──────────┐ ┌──────────┐    │
                │      │SQLite  │ │ Tautulli │ │  Resend  │    │
                │      │/config │ │ + TMDB   │ │  (email) │    │
                │      └────────┘ └──────────┘ └──────────┘    │
                └──────────────────────────────────────────────┘
```

**External dependencies the container talks to:**
- Tautulli HTTP API — source of "recently added" + user/email directory
- TMDB HTTP API — poster art, ratings, summaries for enrichment
- Resend HTTPS API + inbound webhook — email delivery and event stream

**Container mounts:**
- `/config` — SQLite DB (`tortuga.db`) and the optional `tortuga.yml`
- `/data` — reserved for future caching needs (poster art, etc.); not required in v1

**Scheduling.** The newsletter module registers a cron-style schedule with the kernel's scheduler (croner). The schedule is config-driven (`tortuga.yml` → `newsletter.schedule`). The same pipeline is also exposed at `POST /api/digests/run`, which accepts either a session cookie or a bearer token (`DIGEST_RUN_TOKEN`) — so an external cron / Nomad periodic batch can drive it instead.

**For the deployment cluster specifically:** one `<your-infra-repo>/jobs/tortuga/job.nomad` service (Linux class), one CSI volume for `/config`, Authelia ForwardAuth in front of the admin routes, image bump via `versions.json`. Same shape as any other custom service in the cluster.

## Stack

- **Framework:** Next.js 15 (App Router), `output: 'standalone'`, runtime Node 22 LTS
- **Database:** SQLite (file at `/config/tortuga.db`), accessed via Drizzle ORM. Migrations run automatically on startup.
- **Email rendering:** react-email — components in TS/React, snapshot-tested HTML output
- **Email delivery:** Resend SDK + inbound webhook for delivery events
- **Auth:** Auth.js v5 (session mode, credentials provider) **or** ForwardAuth middleware (trusts upstream header)
- **Scheduler:** croner (in-process cron)
- **HTTP clients:** native `fetch` wrapped in typed clients for Tautulli and TMDB
- **Logging:** pino, structured JSON to stdout
- **Validation:** zod for config + API boundaries
- **Testing:** Vitest (unit + integration) and Playwright (smoke)

Rationale for Next.js over alternatives (React Router v7, Hono + React island):
- Largest contributor pool — matters if this grows into an OSS project people want to extend.
- App Router maps cleanly onto the "modules as route groups" structure.
- Server Actions remove a category of API-route boilerplate for admin operations.
- `output: 'standalone'` produces a small, self-host-friendly image. Vercel coupling is neutered.
- Built-in middleware handles the ForwardAuth-vs-session fork in one place.

## Code organization

```
tortuga/
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── (admin)/
│   │   │   ├── layout.tsx              # shared admin chrome + nav
│   │   │   ├── page.tsx                # dashboard (recent sends, status)
│   │   │   └── newsletter/             # module routes
│   │   │       ├── page.tsx            # list of past digests
│   │   │       ├── preview/page.tsx    # render this week's draft
│   │   │       ├── history/page.tsx    # send history + bounce log
│   │   │       └── recipients/page.tsx # view recipient list (read-only)
│   │   ├── api/
│   │   │   ├── digests/run/route.ts    # trigger a send (cron + manual)
│   │   │   ├── webhooks/resend/route.ts# inbound delivery events
│   │   │   ├── unsubscribe/route.ts    # HMAC-verified one-click
│   │   │   └── healthz/route.ts
│   │   └── login/page.tsx              # built-in auth (when not ForwardAuth)
│   │
│   ├── kernel/                         # shared, module-agnostic
│   │   ├── db/                         # drizzle client, migrations
│   │   ├── config/                     # env + tortuga.yml loader, zod schemas
│   │   ├── auth/                       # auth.js + ForwardAuth middleware
│   │   ├── scheduler/                  # croner wrapper, register/unregister
│   │   ├── email/                      # resend client, react-email render helper
│   │   ├── integrations/               # third-party API clients
│   │   │   ├── tautulli.ts
│   │   │   └── tmdb.ts
│   │   ├── logging/                    # pino logger
│   │   └── events/                     # tiny in-process pub/sub for future modules
│   │
│   ├── modules/
│   │   └── newsletter/                 # the one v1 module
│   │       ├── module.ts               # registration: schedules, hooks
│   │       ├── pipeline.ts             # fetch → filter → render → send → record
│   │       ├── filters.ts              # rating, dedupe-by-series, exclude rules
│   │       ├── templates/              # react-email components
│   │       │   ├── digest.tsx
│   │       │   ├── _components/
│   │       │   └── styles.ts
│   │       └── schema.ts               # drizzle tables: digests, sends, events
│   │
│   └── lib/                            # generic utilities only (no business logic)
│
├── drizzle/                            # generated migrations
├── public/
├── docker-compose.example.yml
├── Dockerfile
├── tortuga.example.yml                 # documented config example
├── next.config.mjs                     # output: 'standalone'
└── package.json
```

### Module rules (kept honest as modules accrue)

1. **Modules never import each other.** Cross-module needs go through `kernel/` or `kernel/events`.
2. **Modules own their DB tables.** Drizzle's migration generator unions them.
3. **Kernel knows nothing about specific modules.** No `if (module === 'newsletter')` anywhere in kernel code.
4. **Each module exports one `module.ts`** registering schedules and event handlers at boot. v1's bootstrap is `import './modules/newsletter/module'`.

A formal plugin host is intentionally deferred. The contracts (`registerSchedule`, `onEvent`) are factored out in the kernel, so promoting modules to plugins later is a refactor, not a redesign.

## Data model

All v1 tables are owned by the `newsletter` module (`src/modules/newsletter/schema.ts`). Kernel owns only auth tables.

```ts
digests {
  id            text pk (cuid)
  scheduled_at  timestamp        // when this run was supposed to fire (unique)
  ran_at        timestamp
  window_start  timestamp        // lookback start (e.g. ran_at - 7d)
  window_end    timestamp
  status        text             // pending | rendered | sending | sent | skipped | failed
  item_count    int              // items in the rendered body
  rendered_html text
  rendered_subject text
  error         text nullable
}

sends {
  id            text pk
  digest_id     text fk(digests)
  recipient_email   text
  recipient_name    text
  resend_message_id text nullable
  status        text             // queued | sent | delivered | bounced | complained | failed
  sent_at       timestamp nullable
  error         text nullable
  -- indexes on digest_id and recipient_email
}

send_events {                    // raw Resend webhook log
  id            text pk
  send_id       text fk(sends) nullable
  resend_message_id text
  type          text             // email.sent | email.delivered | email.bounced | ...
  received_at   timestamp
  payload       text             // raw JSON for forensics
}

recipients_cache {               // last-known Tautulli user list
  email         text pk
  name          text
  plex_username text
  last_synced   timestamp
  active        bool             // soft-disable without removing the row
}

items_cache {                    // dedupe + speed up preview
  guid          text pk          // Plex GUID
  payload       text             // enriched item JSON (tautulli + tmdb merged)
  added_at      timestamp
  cached_at     timestamp
}

unsubscribes {
  token         text pk          // HMAC-signed
  email         text
  created_at    timestamp
  used_at       timestamp nullable
}
```

`digests.scheduled_at` is unique to make idempotent triggering trivial — the scheduler and an accidental external POST cannot double-fire the same week. Manual sends synthesize a unique `scheduled_at` from `now()` rounded to seconds.

## Configuration

Two layers — secrets via env vars, declarative settings via `/config/tortuga.yml`.

### Env (required)

```
TAUTULLI_URL          # e.g. http://tautulli.service.consul:8181
TAUTULLI_API_KEY
TMDB_API_KEY
RESEND_API_KEY
APP_URL               # public URL used in email links (https://tortuga.example.com)
SESSION_SECRET        # for Auth.js
```

### Env (optional)

```
AUTH_MODE             # forward | session (default: session)
AUTH_FORWARD_HEADER   # default: Remote-User
ADMIN_EMAIL           # bootstraps first user when AUTH_MODE=session
ADMIN_PASSWORD        # bootstraps first user when AUTH_MODE=session
DATABASE_URL          # default: file:/config/tortuga.db
DIGEST_RUN_TOKEN      # static bearer for external triggering of POST /api/digests/run
LOG_LEVEL             # default: info
```

### `/config/tortuga.yml`

```yaml
newsletter:
  schedule: "0 9 * * SUN"          # cron, in newsletter.timezone
  timezone: "America/New_York"
  lookback_days: 7
  from:
    email: "newsletter@example.com"
    name: "Aurora Plex"
  reply_to: "evan@example.com"
  include_libraries:               # null or omitted = all libraries
    - "Movies"
    - "TV Shows"
  filters:
    min_tmdb_rating: 6.0
    dedupe_episodes_into_seasons: true
    max_items_per_section: 12
    exclude_genres: []
  featured:
    enabled: false                 # editorial slot for later modules; off by default
```

Reload behavior: env vars require container restart (standard Twelve-Factor). `tortuga.yml` is re-read at the top of every digest run and on `SIGHUP`, so configuration iterates without a bounce.

## Digest pipeline

Implemented as one function, `runDigest(opts)`, in `modules/newsletter/pipeline.ts`. Used by the scheduler, the admin "send now" action, and `POST /api/digests/run`. `opts` controls dry-run, override window, and recipient subset (for resends of failed sends).

```
runDigest(opts)
  │
  ▼
INSERT digests row (status='pending', scheduled_at)
  │
  ▼
1. Sync recipients from Tautulli → upsert recipients_cache
   On failure: mark digest 'failed', return
  │
  ▼
2. Pull recently-added from Tautulli for window [end - lookback, end]
  │
  ▼
3. Enrich items with TMDB
   - items_cache hit → skip
   - miss → fetch poster, rating, summary
   - parallel fetches with concurrency limit (~5)
   - cache results in items_cache
  │
  ▼
4. Apply filters (modules/newsletter/filters.ts)
   - drop below min_tmdb_rating
   - filter by include_libraries
   - drop excluded genres
   - dedupe episodes → season rollups
   - cap to max_items_per_section
  │
  ▼
5. Render via react-email → { subject, html, text }
   UPDATE digests SET status='rendered', rendered_html, rendered_subject, item_count
  │
  ▼
   If dry_run: return; UI renders the HTML in preview pane
   If item_count == 0: status='skipped', return (no empty digests)
  │
  ▼
6. Fan out sends
   UPDATE digests SET status='sending'
   For each active recipient:
     INSERT sends row (status='queued')
     Inject HMAC unsubscribe token
   Send via Resend batch API (up to 100/batch)
     → store resend_message_id, status='sent'
   Per-send failures: status='failed', record error
  │
  ▼
7. UPDATE digests SET status='sent', ran_at=now
   (status='sent' if at least one send succeeded; otherwise 'failed')
```

Asynchronous parallel paths:

- `POST /api/webhooks/resend` — verify `Resend-Signature` HMAC, write `send_events`, update `sends.status` on terminal events (delivered/bounced/complained).
- `GET /api/unsubscribe?token=...` — verify HMAC, look up email, set `recipients_cache.active = false`, mark `unsubscribes.used_at`, render a confirmation page.

### Intentional choices

- **Idempotency.** Unique constraint on `digests.scheduled_at`. Cron + external trigger cannot double-fire.
- **Empty-digest suppression.** `item_count == 0` after filtering → `skipped`. No "nothing new this week" emails.
- **Per-send failures are non-fatal.** Digest transitions to `sent` if ≥1 success. Failed sends surface in the history view with a "retry failed sends" action.
- **No auto-retries of failed sends.** Resend handles transport-level retries. Admin retries are explicit and observable.
- **Preview = dry-run.** `runDigest({ dry_run: true })` renders + persists the row but skips fan-out. Preview history is searchable.

## Auth

Two modes, selected by `AUTH_MODE`:

- **`forward`** — Middleware reads `AUTH_FORWARD_HEADER` (default `Remote-User`) from upstream. If present, a synthetic session is constructed. If absent, requests are rejected. For Authelia/Authentik/Caddy/forward-auth scenarios.
- **`session`** — Auth.js v5 with a credentials provider. Single admin account (multi-user is a future module). Password hashed with argon2id. First-boot bootstrap reads `ADMIN_EMAIL` + `ADMIN_PASSWORD` env if no user exists.

All `/app/(admin)/*` and most `/api/*` routes require a session. Public routes:

- `GET /api/healthz`
- `GET /api/unsubscribe?token=...` — HMAC-verified
- `POST /api/webhooks/resend` — HMAC-verified (`Resend-Signature`)

`POST /api/digests/run` accepts a session cookie **or** a static bearer token `DIGEST_RUN_TOKEN`, enabling external cron / Nomad periodic batch.

## Error handling

- **Typed integration errors.** `TautulliError`, `TmdbError`, `ResendError` from `kernel/integrations`. Each carries `cause`, `retryable: boolean`, `status` (HTTP).
- **HTTP client retries.** 3 attempts with exponential backoff on network errors and 5xx. 4xx errors fail fast — they are configuration problems.
- **Pipeline errors.** Any error after `digests` row insertion flips `status='failed'`, stores full message + stack in `error`, returns. Admin UI's digest detail page renders this.
- **Webhook verification failures.** Return 401, log a `warn` (truncated body), do not write to DB.
- **Unsubscribe token failures.** Render a friendly "this link is no longer valid" page. Do not expose token internals.
- **Per-send failures.** Non-fatal at the digest level; visible in history with "retry failed sends".

## Observability

- **Structured logging.** pino → stdout JSON. Consistent keys: `digest_id`, `send_id`, `recipient_email`, `module`. Promtail scrapes in the homelab; everyone else gets `docker logs`.
- **`/api/healthz`.** Returns `{ db: ok, tautulli: ok|fail, resend: ok|unknown, ts }`. Tautulli probe is a real call; Resend probe is light (key present + last successful send timestamp from `digests`).
- **`/app/(admin)/health` page.** Last digest status, last webhook event, last successful Tautulli sync, integration latencies, current schedule cron + next fire time.
- **Prometheus metrics.** Counters are exported from `digests.run` calls in code; the `/metrics` route is not built in v1 but the kernel structure is ready for it.

## Testing

Vitest as runner.

1. **Unit** — `filters.ts` (rating threshold, dedupe, library include, max items), HMAC token gen/verify, template helpers, config zod parsers. No external dependencies. Fast.
2. **Integration** — pipeline tests with typed fake clients for Tautulli/TMDB/Resend, running against an in-memory SQLite that runs real Drizzle migrations. Covers: happy path, empty-digest skip, partial send failure, idempotency under double-fire, unsubscribe lifecycle, webhook signature verification.
3. **Smoke (Playwright)** — admin login, navigate to preview, trigger dry-run, view history. Runs in CI against the built standalone image.

**Email templates** get react-email `render()` snapshot tests. Template diffs are reviewed in PRs.

## CI / release

GitHub Actions:

1. PR / push: `pnpm install` → `pnpm test` → `pnpm build`.
2. Push to `main`: build Docker image, push to `ghcr.io/evandcoleman/tortuga:<sha>` and `:latest`. Tag releases also push `:vX.Y.Z`.
3. After image push on `main`: call `<your-infra-repo>/.github/workflows/update-version.yml` to bump `versions.json`. Deployment cluster CI then deploys.

## Deployment artifacts

For the deployment cluster:

- `<your-infra-repo>/jobs/tortuga/job.nomad` — Linux class service, exposes one HTTP port, Vault template for `RESEND_API_KEY` / `TAUTULLI_API_KEY` / `TMDB_API_KEY` / `SESSION_SECRET`, CSI volume for `/config`, `AUTH_MODE=forward`, Authelia ForwardAuth via Traefik tags.
- `<your-infra-repo>/vault-policies/tortuga.hcl` — read on `kv/tortuga`, `kv/tautulli`, `kv/tmdb`, `kv/resend`.
- `<your-infra-repo>/versions.json` — `tortuga` key pointing at `ghcr.io/evandcoleman/tortuga:<tag>`.

For everyone else:

- `docker-compose.example.yml` in the repo root with sensible defaults, bind-mounted `./config` directory, all required env vars commented.
- `tortuga.example.yml` documented inline.
- `README.md` with quickstart, env var reference, config reference, and example reverse-proxy snippets (Caddy + Traefik + nginx).

## Risks and open questions

- **SQLite over NFS.** For the homelab, the CSI volume is NFS-backed. SQLite has known locking edge cases over NFS. Mitigation: use WAL mode + `busy_timeout`; only one container writes; we control writers. If this becomes a problem, the same Drizzle schema runs unchanged on Postgres — fallback is well-defined.
- **TMDB API rate limits.** Free tier is 40 req / 10 sec. The concurrency limit (5) plus `items_cache` makes this comfortable, but worth monitoring on first runs against a large lookback window.
- **Resend free tier limits.** 3,000 emails/month, 100/day. Adequate for personal/community-sized Plex servers; documentation should note this.
- **Tautulli email mapping completeness.** Tautulli stores emails per user, but the field is optional and may be sparse. The recipient sync surfaces "users without email" in the recipients page; admin manually adds them in Tautulli.
- **Email deliverability for self-hosters who own a domain.** Resend requires domain verification (SPF/DKIM/DMARC) for the `from` address. README must call this out clearly.

## What's intentionally deferred

- Multi-user admin / role-based access.
- Plugin host abstraction (modules-as-folders for now).
- Postgres adapter (Drizzle keeps the path open).
- Per-user personalization, recommendations, watch-history correlation.
- Broadcasts, invites, user directory, re-engagement campaigns, curation tooling — all future modules with their own design docs.
- Prometheus `/metrics` endpoint (counters exist; route doesn't).
- i18n for emails and admin UI.
