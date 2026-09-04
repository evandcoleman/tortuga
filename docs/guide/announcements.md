# Announcements

One-off messages to some or all of your recipients — server maintenance
notices, new feature callouts, anything outside the regular newsletter
digest. Composed at `/messages`.

## Compose

The composer (`MessageComposer`, backed by `src/modules/announcements/pipeline/send.ts`)
takes a subject, a markdown body, and a recipient list, then offers:

- **Dry run** — renders without sending.
- **Send test to me** — sends one copy to your admin address; this never
  creates an announcement row (it does not show up in history).
- **Send now** — sends to the resolved recipient list immediately.
- **Schedule** — queues the announcement for a future wall-clock time (see
  below) instead of sending immediately.

Only recipients who are still deliverable at *send time* (active, not
suppressed, opted into the `announcements` category — see
[Recipients](./recipients.md)) actually receive the message; the list you pick
at compose time is filtered again when the send actually executes.

## Choose audience

The recipient picker lists every **active** cached recipient
(`recipientsCache`, filtered `active = true`), sorted by email. There is no
saved "audience" or segment concept — every send picks recipients explicitly
by email.

## Templates library

`/messages/templates` is a small library of reusable subject/body pairs. Each
template's body is markdown containing `{{variable}}` placeholders,
substituted at send time by `substituteVariables()`
(`src/modules/templates/substitute.ts`):

- `{{name}}` — recipient's name; falls back to the email's local part
  (`grover` from `grover@x.io`) if no name is known, and renders literally
  (`{{name}}`) only if there's neither a name nor an email to fall back to.
- `{{email}}` — recipient's email.
- `{{server_name}}` — `newsletter.from.name`.
- Any other `{{token}}` is left untouched if no matching value is supplied
  (unknown tokens never throw or blank out).

Composing from a template pre-fills subject/body, which you can still edit
before sending — editing does not modify the saved template. The `welcome`
template (used by [Invites](./invites.md)) is marked **System** in the
library and is not meant to be deleted.

## Scheduled announcements

Scheduling stores a `scheduled` row (`scheduleAnnouncement()`) with the
recipient list snapshotted as JSON and a `scheduledAt` timestamp. Recipients
are **re-resolved for deliverability at send time**, not at schedule time — a
recipient who unsubscribes between scheduling and sending is dropped
automatically.

- **Timezone**: the time you pick in the composer is interpreted in
  `newsletter.timezone` (the same timezone the newsletter schedule uses), not
  the browser's local timezone.
- **Firing**: `registerAnnouncementsModule()` registers a once-a-minute cron
  job (`* * * * *`, independent of `newsletter.schedule_enabled` — that flag
  only pauses the newsletter digest) that claims and sends any row whose
  `scheduledAt` has passed. The claim is atomic (`status: scheduled -> sending`
  guarded by a `WHERE status = 'scheduled'`), so a row can't be double-sent
  even if two ticks overlap.
- **Missed sends**: if the app was down when a schedule was due, it fires on
  the next tick after startup rather than being skipped.
- **Edit / cancel**: a row can only be edited or cancelled while still
  `status = 'scheduled'` — once the runner claims it (`sending`) an edit or
  cancel request is rejected (no-op), since the send is already in flight or
  done. The pending list on `/messages` shows every scheduled row with edit
  and cancel actions.

## History

`/messages/history` lists past sends (immediate and fired-scheduled) with
status (`sending` / `sent` / `partial` / `failed` / `cancelled`), recipient
count, and — for partial/failed sends — the recorded error. `/messages/history/[id]`
shows the full rendered HTML and per-recipient send outcomes for one
announcement.

## Related

- [Newsletter](./newsletter.md)
- [Recipients](./recipients.md)
- [Invites](./invites.md)
