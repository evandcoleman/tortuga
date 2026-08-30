# One-off announcements to Plex users

**Status:** approved 2026-08-29
**Goal:** Let the admin compose and send a one-off email (subject + markdown body) to all or a chosen subset of active recipients, using the same themed shell and delivery tracking as the weekly digest.

## Scope

In: compose, rendered preview, send test to a single address, send to selected recipients, history with per-send status.
Out: drafts, scheduling, attachments, embedding library items, editing/resending after send, retries.

## Data

New table `announcements` (in `src/modules/announcements/schema.ts`):

| column | type | notes |
|---|---|---|
| id | text PK | nanoid, same as digests |
| subject | text NOT NULL | 1–200 chars |
| body | text NOT NULL | markdown source |
| recipientEmails | text NOT NULL | JSON array of emails targeted at send time |
| status | `'sending' \| 'sent' \| 'partial' \| 'failed'` | `partial` = ≥1 send failed and ≥1 succeeded; `failed` = all failed or render error |
| renderedHtml | text | stored once; every recipient gets the same HTML except the unsubscribe URL |
| createdAt, sentAt | timestamp_ms | |
| error | text | render/provider error summary |

`sends` change: `digestId` becomes nullable; add nullable `announcementId` (FK → announcements.id, indexed). Exactly one of the two is set. Migration generated with `drizzle-kit generate` (SQLite recreates the table for the nullability change — do not hand-write the journal entry).

## Pipeline

`src/modules/announcements/pipeline/send.ts` exports:

```ts
sendAnnouncement(deps, input: {
  subject: string; body: string;
  recipientEmails: string[];       // must be ⊆ active recipients (validated by caller)
  dryRun?: boolean;                // render only, no announcement row, no sends
  testRecipient?: string;          // send once to this address, no announcement row
}): Promise<{ html: string; announcementId?: string; sent: number; failed: number }>
```

Behaviour mirrors `runDigest` (`src/modules/newsletter/pipeline/run.ts:161–195`): render once, loop recipients, mint a per-recipient unsubscribe token, insert a `queued` send row, call `emailProvider.send`, update the row to `sent`/`failed`. Provider failure on one recipient is recorded and the loop continues. Final announcement status per the table above. Recipients with `active = false` are never sent to even if passed in (defense in depth).

## Rendering

- Extract the digest's outer wrapper (Html/Body/Container, theme colours, appearance header + footer incl. unsubscribe link and disclaimer) from `templates/digest.tsx` into `src/modules/newsletter/templates/shell.tsx` (`EmailShell`, props: theme, appearance, unsubscribeUrl, children). `DigestEmail` is refactored to use it with no visual change (existing digest snapshot tests must still pass).
- `src/modules/announcements/templates/announcement.tsx`: `AnnouncementEmail` = `EmailShell` around `marked.parse(body)` in a `Section`. Markdown is trusted admin input; no sanitiser beyond what `marked` does. Uses the configured default theme and current appearance config; no layout selection.

## Admin UI

- `/newsletter/messages` (`src/app/(admin)/newsletter/messages/page.tsx`): form with subject, markdown textarea, recipient checklist (active recipients, all checked by default, "select all / none"), and a rendered preview panel that updates on a "Preview" submit (server action, dryRun). Buttons: **Send test to me** (uses signed-in admin's email, `testRecipient`), **Send to N recipients** (browser confirm, then server action).
- `/newsletter/messages/history`: table of announcements (subject, sent at, status, sent/failed counts) linking to a detail with per-send status, reusing the digest history components where they fit.
- Tile "Messages" added to `/admin/newsletter` hub.
- Server actions in `messages/actions.ts`, zod-validated: subject 1–200, body non-empty ≤ 20k chars, recipientEmails non-empty and each present in active recipients. Same auth helper as existing newsletter actions.

## Module wiring

`src/modules/announcements/module.ts` registers the schema with the app context following `registerNewsletterModule`; no cron. Also register in the app-context module list.

## Tests (vitest, existing `fakes()` helper pattern)

- pipeline: full send records N `sent` rows and status `sent`; dryRun writes nothing; testRecipient sends exactly one and writes no announcement row; one provider failure → `partial` with correct counts; inactive email in input is skipped.
- templates: `AnnouncementEmail` renders markdown (heading + link) inside shell with unsubscribe URL; digest snapshot tests unchanged after shell extraction.
- actions: rejects empty subject, subject > 200, email not in active list; accepts valid input.
