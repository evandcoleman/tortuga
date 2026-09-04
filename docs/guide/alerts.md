# Alerts

`/alerts` is Tortuga's internal health dashboard: a record of scheduler
failures, delivery problems, and provider rejections, surfaced to admins on
the page and (optionally) by email.

## What triggers an alert

Once a minute, `registerAlertsModule()` runs a sweep (`allSweepCandidates()`
in `src/modules/alerts/conditions.ts`) that checks:

- **`digest_failed`** — any digest with `status = 'failed'` in the last 7
  days (one alert per digest, keyed by digest id).
- **`announcement_failed`** — any announcement `failed` or `partial` in the
  last 7 days.
- **`rejection_spike`** — 3 or more provider-rejected sends (`status: failed`)
  within the last hour.
- **`bounce_spike`** — 3 or more bounce events within the last 24 hours.
- **`complaint`** — any spam complaint event in the last 7 days (one alert
  per event).
- **`scheduler_error`** — any registered cron job (digest, announcements
  runner, alerts sweep itself) throwing an uncaught error; this one is
  triggered directly by the scheduler's error listener, not by the sweep.

Each alert has a stable `key` so re-running the sweep **updates** (title,
detail, `updated_at`) an existing open alert instead of duplicating it — a
digest that keeps failing doesn't spam the dashboard with one row per minute.
`rejection_spike`, `bounce_spike`, and `scheduler_error` are further keyed to
one alert per calendar day (in `newsletter.timezone`), so a sustained problem
still produces at most one row a day per kind.

## Thresholds

The rejection-spike and bounce-spike thresholds (3 within 1 hour / 3 within
24 hours, respectively) are fixed constants
(`REJECTION_SPIKE_MIN`, `BOUNCE_SPIKE_MIN` in `src/modules/alerts/conditions.ts`)
— not currently configurable via `tortuga.yml`.

## Dashboard panel

`/alerts` lists every alert (most recent first, capped at 100 rows) with its
status (**Open** / **Acknowledged**), kind, title/detail, and creation time.
Failed-digest and failed-announcement alerts link directly to the relevant
history row (`/newsletter/history` or `/messages/history/[id]`).

## Admin email

If `ADMIN_EMAIL` and an email provider are configured, newly created (not
yet emailed) alerts are batched into a single transactional email to the
admin address, subject `[Tortuga] N new alert(s)`, listing each alert's
title/detail with a link back to the dashboard. Delivery is retried up to 3
attempts per alert (`MAX_EMAIL_ATTEMPTS`); after that it's given up on and
only visible on the dashboard. If `ADMIN_EMAIL` or the provider isn't
configured, alerts remain dashboard-only (logged once, not on every sweep
tick).

## Acknowledging

The **Acknowledge** action sets `acknowledged_at` on an alert (or on every
open alert, via the "Acknowledge all" button shown whenever any alert is
open). Acknowledging does not delete the row or prevent the same `key` from
reopening later if the underlying condition recurs — the sweep upserting a
new candidate for the same key does not automatically clear
`acknowledged_at` on retitle, so a previously-acknowledged, still-recurring
problem may need re-acknowledging as new detail is written to it.

## Related

- [Newsletter](./newsletter.md)
- [Announcements](./announcements.md)
- [Email providers](./email-providers.md)
