# Scheduled announcement sends

Roadmap item 4. Compose is fire-now only; let an announcement be written on
Wednesday and sent Saturday at 9pm. Scheduled announcements can be listed,
edited, and cancelled until they fire.

## Decisions

- **Mechanism: polling job.** One scheduler task runs every minute, claims
  due rows atomically, and sends them through the existing pipeline. No
  in-process timers, no boot-time sweep. Up to 60s send latency is accepted.
- **Timezone: configured `newsletter.timezone`.** The picker shows and accepts
  wall-clock time in that zone; the row stores UTC.
- **Management: list, edit, cancel.** Edit reopens the composer prefilled.
- **Recipients resolve at send time.** The admin's selection is stored, but
  active status, category preferences, and suppression are re-checked when
  the send fires, exactly as an immediate send does.
- **Missed sends fire late.** If the server was down at the scheduled time,
  the next tick sends immediately. No cutoff.

## Data model

`announcements` gains:

- `scheduled_at` integer (timestamp_ms), nullable. Set only on rows created
  via schedule.
- `status` type widens to `'scheduled' | 'cancelled' | 'sending' | 'sent' | 'partial' | 'failed'`.

Migration `0013_scheduled_announcements.sql` generated with `drizzle-kit
generate` (hand-written journal entries silently skip on prod; see memory).

A scheduled row stores subject, body, the selected `recipientEmails`,
`createdAt`, `scheduledAt`, `renderedHtml = null`. On send, `renderedHtml`,
`recipientEmails` (narrowed to delivered targets), `status`, `sentAt`, and
`error` are written the same way an immediate send writes them.

## Pipeline (`src/modules/announcements/pipeline/`)

`send.ts` keeps `sendAnnouncement` and its public shape. The post-render
"filter deliverable, deliver, finalize status" block is extracted into an
internal `deliverAnnouncement(deps, { announcementId, subject, body,
recipientEmails, html })` so both paths share it.

New file `schedule.ts`:

- `scheduleAnnouncement(db, { subject, body, recipientEmails, scheduledAt })
  → id`. Inserts a `scheduled` row.
- `updateScheduledAnnouncement(db, id, { subject, body, recipientEmails,
  scheduledAt }) → boolean`. `UPDATE … WHERE id = ? AND status = 'scheduled'`;
  false when no row changed.
- `cancelScheduledAnnouncement(db, id) → boolean`. Same guard; sets
  `status = 'cancelled'`.
- `listScheduledAnnouncements(db)`. Rows with `status = 'scheduled'` ordered
  by `scheduledAt` ascending.

New file `run-due.ts`:

- `sendScheduledAnnouncement(deps, id) → { outcome: 'skipped' | 'sent' | 'failed', sent, failed }`.
  1. Claim: `UPDATE announcements SET status = 'sending' WHERE id = ? AND
     status = 'scheduled'`. If zero rows changed, return `skipped`. This is
     the only concurrency guard and makes overlapping ticks safe.
  2. Render. On failure set `status = 'failed'`, `error = message`,
     `sentAt = now`, return `failed`. Never throw out of the runner.
  3. Filter `recipientEmails` through `selectDeliverableRecipients(db,
     'announcements')`. If zero targets, set `status = 'failed'`, `error =
     'No deliverable recipients at send time'`, return `failed`.
  4. `deliverAnnouncement` with `sendRow: { announcementId: id }`, finalize
     status as today.
- `runDueAnnouncements(deps, now = new Date()) → { due, sent, failed, skipped }`.
  Selects ids with `status = 'scheduled' AND scheduledAt <= now` ordered by
  `scheduledAt`, sends them sequentially, logs a one-line summary.

## Module registration

New `src/modules/announcements/module.ts` exporting
`registerAnnouncementsModule()`, called from `src/modules/index.ts` after
the newsletter module. Registers:

```
name: 'announcements.scheduled', cron: '* * * * *', timezone: config.newsletter.timezone
```

Handler: if `ctx.email` is null, log a warning once per tick and return
(rows stay `scheduled`). Otherwise call `runDueAnnouncements` with the same
deps shape the server actions build. Not gated by
`newsletter.schedule_enabled`; that flag governs the digest only.

## Time helper (`src/kernel/time/zoned.ts`)

No new dependency. Two pure functions built on `Intl.DateTimeFormat`:

- `wallClockToUtc(wall: 'YYYY-MM-DDTHH:mm', timeZone) → Date`
- `utcToWallClock(date, timeZone) → 'YYYY-MM-DDTHH:mm'`

Unit tests cover a winter date, a summer date, and both DST transitions for
`America/New_York`. A wall-clock time that does not exist (spring-forward
gap) resolves to the first valid instant after the gap.

## Server actions (`src/app/(admin)/messages/actions.ts`)

Shared validation with `sendAnnouncementToRecipients` (subject, body,
recipients all active). New:

- `scheduleAnnouncementToRecipients(subject, body, recipientEmails, wallClock)`.
  Converts `wallClock` via the configured timezone; rejects times not at
  least one minute in the future with "Scheduled time must be in the
  future". Returns `{ success: true, announcementId, scheduledAt }`.
- `updateScheduledAnnouncement(id, subject, body, recipientEmails, wallClock)`.
  Same validation. Returns "This message is no longer scheduled" when the
  guarded update changes zero rows.
- `cancelScheduledAnnouncement(id)`. Same guard and error text.

All three call `requireAdminSession()` and revalidate `/messages`,
`/messages/history`, and `/`.

## UI

**Compose page (`/messages`).** A "Scheduled" card above the composer lists
pending rows: subject, "Sends <formatted wall-clock> (<timezone>)", recipient
count, Edit link, Cancel button (with confirm). Hidden when empty.

**Composer.** Below the existing Send section, a "Schedule" section with a
`datetime-local` input labelled with the timezone name and a "Schedule
send" button enabled only when a time is set. Preview and Test send are
unchanged. Success replaces the section with "Scheduled for <time>" and a
link back to the list.

**Edit page (`/messages/scheduled/[id]`).** Renders `MessageComposer` with
an `editing` prop `{ id, subject, body, recipientEmails, wallClock }`. In
edit mode: Send now is hidden, the Schedule section is prefilled, its button
reads "Update schedule", and a "Cancel schedule" button sits beside it. A
row that is no longer `scheduled` renders a notice and a link to history
instead of the composer.

**History (`/messages/history`).** Badge tones add `scheduled: neutral` and
`cancelled: neutral`. The "Sent at" column shows the scheduled time for
`scheduled` rows and stays blank for `cancelled`.

## Error handling

- Provider unconfigured at tick: warn, leave rows untouched.
- Runner exceptions per row are caught and recorded on that row; one bad row
  never blocks the rest of the batch.
- Edit or cancel racing the runner: the guarded update fails and the action
  returns "This message is no longer scheduled".

## Testing (vitest, `pnpm test`)

- `schedule.test.ts`: insert shape; update and cancel succeed only while
  `scheduled`; list order.
- `run-due.test.ts`: future rows ignored; due rows sent with `sendRow`
  linked; second claim on the same id is `skipped`; recipients inactive,
  unsubscribed from `announcements`, or suppressed at send time are dropped;
  zero targets marks `failed`; render failure marks `failed` without
  throwing; one failing row does not stop the next.
- `zoned.test.ts`: round-trips and DST cases above.
- `actions.test.ts`: past time rejected; inactive recipient rejected; update
  and cancel on a sent row return the "no longer scheduled" error.

## Out of scope

Recurring announcements, drafts that are not scheduled, per-recipient
timezone delivery, a cutoff for very late sends.
