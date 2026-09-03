# Admin failure alerts

Roadmap "Later" item. Scheduler failures, provider rejections, and bounce or
complaint spikes currently end up in per-table status columns or the log.
This surfaces them on the dashboard and emails the admin.

## Decisions

- **Channel: dashboard panel plus email to `ADMIN_EMAIL`.** No webhook.
- **Detection: periodic sweep** over the tables where failures already land,
  plus a scheduler error listener for the one source not in the database.
- **Thresholds are fixed constants**, not settings.
- **Email is batched per sweep**: one message listing every alert the sweep
  created, so a spike does not produce a spike of emails.
- **Noise bound: one alert per kind per day** for spikes and scheduler
  errors, keyed on the calendar day in `newsletter.timezone`.

## Data model

New table in `src/modules/alerts/schema.ts`, migration generated with
`drizzle-kit generate`:

```
alerts
  id             text primary key
  kind           text not null   -- see Conditions
  key            text not null unique   -- dedup key
  title          text not null
  detail         text            -- error text or counts
  href           text            -- admin page to open, e.g. /messages/history/<id>
  created_at     integer not null (timestamp_ms)
  updated_at     integer not null
  acknowledged_at integer
  emailed_at     integer
  email_attempts integer not null default 0
```

## Conditions

| kind | source | key | title |
|---|---|---|---|
| `scheduler_error` | scheduler listener | `scheduler:<name>:<day>` | `Scheduled job "<name>" threw` |
| `digest_failed` | `digests.status = 'failed'` | `digest:<id>` | `Digest failed` |
| `announcement_failed` | `announcements.status in ('failed','partial')` | `announcement:<id>` | `Announcement failed` / `Announcement partially sent` |
| `rejection_spike` | `sends.status = 'failed'` with `sent_at` in the last hour, count >= 3 | `rejections:<day>` | `<n> sends rejected by the provider in the last hour` |
| `bounce_spike` | `send_events.type = 'bounced'` with `received_at` in the last 24h, count >= 3 | `bounces:<day>` | `<n> bounces in the last 24 hours` |
| `complaint` | each `send_events` row with `type = 'complained'` | `complaint:<event id>` | `Spam complaint received` |

Constants in `src/modules/alerts/conditions.ts`:
`REJECTION_SPIKE_MIN = 3`, `REJECTION_WINDOW_MS = 1h`, `BOUNCE_SPIKE_MIN = 3`,
`BOUNCE_WINDOW_MS = 24h`, `SWEEP_LOOKBACK_MS = 7d`.

Row-keyed conditions (`digest_failed`, `announcement_failed`, `complaint`)
only consider rows created or received within `SWEEP_LOOKBACK_MS`, so the
first sweep after deploy does not resurrect old history.

`detail` holds the source row's `error` text for digest and announcement
alerts, the count for spikes, and the error message for scheduler errors.
`href` points at `/newsletter/history` (digest; there is no per-digest
page), `/messages/history/<id>` (announcement), or is null.

## Sweep (`src/modules/alerts/sweep.ts`)

`sweepAlerts(db, now = new Date()) → { created: Alert[] }`. For each
condition, compute candidates and `INSERT … ON CONFLICT (key) DO UPDATE SET
detail, updated_at` so a repeating condition refreshes its detail without
creating a second row. Returns only rows whose `created_at` equals this
sweep, which is what gets emailed. Pure DB, no email, no context.

## Scheduler listener

`createScheduler()` gains `onError(listener: (name: string, err: unknown) =>
void)`. The catch block that currently only logs also invokes every
listener, each in its own try/catch so a listener failure cannot mask the
original. `src/modules/alerts/module.ts` registers a listener that upserts
a `scheduler_error` alert with the day-bucket key and the error message.

## Email (`src/modules/alerts/email.ts`)

`emailPendingAlerts(deps, now) → { emailed: number, skipped: number }`.

- Selects alerts with `emailed_at IS NULL AND email_attempts < 3`.
- If none, return.
- If `deps.adminEmail` is null or `deps.provider` is null, log once per
  process at warn level and return (dashboard still shows them).
- Renders one message via `renderTemplate` from the templates module using
  an inline subject `[Tortuga] <n> new alert(s)` and a markdown body
  listing title, detail, and an absolute link for each alert. Transactional:
  no unsubscribe or preferences links, no `sends` row.
- On provider success set `emailed_at` on every included alert; on failure
  increment `email_attempts` on each and log. Retries happen on later
  sweeps until three attempts.

## Module registration

`src/modules/alerts/module.ts` exports `registerAlertsModule()`, called last
in `src/modules/index.ts`. Registers `alerts.sweep` on `* * * * *` in
`newsletter.timezone`. Handler: `sweepAlerts`, then `emailPendingAlerts`
with `{ db, provider: ctx.email, config: ctx.config.newsletter, appUrl,
adminEmail: ctx.env.ADMIN_EMAIL ?? null }`. Also registers the scheduler
error listener.

## Dashboard

`src/app/(admin)/page.tsx` renders an `AlertsPanel` above the existing
content when any unacknowledged alerts exist. Danger-toned card titled
"Needs attention", listing up to 20 newest unacknowledged alerts: title,
detail (one line, truncated), relative time, optional "Open" link, and an
Acknowledge button. Header has "Acknowledge all". Hidden when empty.

Server actions in `src/app/(admin)/alerts/actions.ts`:
`acknowledgeAlert(id)` and `acknowledgeAllAlerts()`, both behind
`requireAdminSession()`, setting `acknowledged_at = now` where null, then
`revalidatePath('/')`.

## Error handling

- Sweep exceptions propagate to the scheduler, which logs them and, via the
  listener, creates a `scheduler_error` alert for `alerts.sweep` itself.
- The listener never throws.
- Email failures never block the sweep; see attempts cap above.

## Testing (vitest, `pnpm test`)

- `sweep.test.ts`: each condition creates exactly one alert; re-running
  creates none and refreshes `detail`; below-threshold counts create
  nothing; rows older than the lookback are ignored; `partial` and
  `failed` announcements get different titles.
- `scheduler.test.ts`: `onError` listeners fire with name and error; a
  throwing listener does not prevent the next listener or the log.
- `email.test.ts`: batches all pending into one send; sets `emailed_at`;
  provider failure increments attempts and leaves `emailed_at` null; the
  fourth attempt is skipped; null admin email or provider skips without
  error; body contains each alert's title and absolute href.
- `actions.test.ts`: acknowledge sets the timestamp once; acknowledge all
  leaves already-acknowledged rows untouched.

## Out of scope

Outbound webhooks, configurable thresholds, an alert history page,
per-kind muting, alerts for Tautulli or TMDB outages (the dashboard already
shows missing services).
