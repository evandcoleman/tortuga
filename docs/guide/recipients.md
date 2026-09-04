# Recipients

`/people/recipients` is Tortuga's list of people who can receive email —
where it comes from, how opt-outs work, and what a bounce or spam complaint
does to a recipient's status.

## Where recipients come from

Every digest run calls `syncRecipients()`
(`src/modules/newsletter/pipeline/recipients.ts`), which pulls users from
`tautulli.getUsers()` and upserts anyone with an email address into the local
`recipients_cache` table. Recipients can also be added by hand from
`/people/recipients` (the import form) — those rows are tagged
`source: manual` and are **never overwritten** by a later Tautulli sync,
though they still receive digests/announcements like any other active
recipient.

The page header stats (Active / Manual / Not welcomed / Unsubscribed) and the
table read directly from this cache.

## Active / inactive

A recipient's `active` flag controls whether they receive anything. Setting
it to `false` is a **hard suppression** — it stops both digest and
announcement delivery outright, and is set automatically on a hard bounce or
spam complaint (see below), or manually by an admin. An inactive recipient's
`/preferences` link responds with "Preferences unavailable... contact the
server admin" instead of a form — they cannot self-reactivate.

## Preferences page

Every send includes a signed `/preferences?token=...` link
(`preferencesUrl()`, `src/kernel/email/preferences-token.ts`). The token:

- Is **reusable** (unlike the one-shot unsubscribe token) and expires after
  **180 days** from mint time.
- Lets the recipient toggle two independent categories — **Weekly digest**
  and **Announcements** — and, if `newsletter.include_libraries` is set,
  which specific libraries they want included in their digest (unchecked =
  excluded from their personal digest, not a global setting).

## Category unsubscribe vs. hard suppression

Clicking the one-click unsubscribe link in an email (`/api/unsubscribe?token=...`)
opts the recipient **out of that one category only** — `digest` or
`announcements` — via `setCategory()`. It does **not** touch `active`. The
unsubscribe token:

- Is single-use (claimed atomically on first use; a replayed link responds
  "invalid or has been used").
- Expires after **90 days**.
- Is category-scoped: the confirmation page offers "Resubscribe" (undoes the
  unsubscribe) and "Also stop [the other category]", plus a link to the full
  `/preferences` page.

This is intentionally distinct from hard suppression: unsubscribing from the
digest does not affect an admin sending you a scheduled maintenance
announcement, and vice versa.

## Bounces and complaints

Both Resend and Mailgun webhooks (`POST /api/webhooks/resend`,
`POST /api/webhooks/mailgun`) record delivery events on the matching `sends`
row and call `suppressRecipientForSend()`, which sets `active: false` and
records a `suppressedReason`:

- **Complaint** (spam report) — always suppresses.
- **Bounce** — only a **permanent/hard** bounce suppresses. Resend
  distinguishes bounce subtypes and only suppresses on `bounceType: permanent`;
  transient/undetermined bounces are logged but do not suppress. Mailgun's
  webhook normalization already separates permanent failures (mapped to
  `bounced`) from transient ones, so any `bounced` event from Mailgun is
  treated as hard.

Suppression from a bounce/complaint cannot be undone by the recipient — only
an admin can flip `active` back to `true` for that row.

## Related

- [Newsletter](./newsletter.md)
- [Announcements](./announcements.md)
- [Invites](./invites.md)
- [Email providers](./email-providers.md)
