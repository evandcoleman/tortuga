# Resubscribe & recipient preferences

Roadmap item 3. Unsubscribe is currently one-way and collapses every reason
(manual, bounce, complaint) into `recipientsCache.active = false`. This adds a
resubscribe path, per-recipient message categories, a per-recipient library
filter for the digest, and a suppression reason so hard suppressions cannot be
self-revived.

Frequency is explicitly deferred. Admin UI for editing preferences or clearing
suppressions is out of scope. No portal "email me a link" form.

## Data model

New table `recipient_preferences` (own module, Drizzle migration via
`drizzle-kit generate`):

| column          | type                     | notes                                   |
|-----------------|--------------------------|-----------------------------------------|
| `email`         | text PK                  | matches `recipientsCache.email`         |
| `digest`        | boolean, default true    | weekly digest category                  |
| `announcements` | boolean, default true    | announcements category                  |
| `libraries`     | JSON string[] or null    | Plex section names; null = all          |
| `updatedAt`     | timestamp                |                                         |

Absence of a row means all defaults. Rows are never deleted by Plex sync.

`recipientsCache` gains `suppressedReason`: `null | 'bounce' | 'complaint' | 'admin'`.
`active = false` now means hard suppression only. Bounce/complaint webhooks set
both `active = false` and the reason. Existing `active = false` rows with no
reason are backfilled to `'admin'` in the migration; the admin can clear them by
hand if any were manual unsubscribes.

## Categories

Two categories: `digest` and `announcements`. `deliverToRecipients` takes a
required `category` argument. The recipient filter becomes
`active && prefs[category]`. The digest pipeline passes `digest`; announcement
send passes `announcements`. Welcome and test sends are transactional and do
not go through the filter.

## Unsubscribe semantics

- RFC 8058 one-click POST: sets the category of the message that carried the
  token to false. Does not touch `active`. The unsubscribe token records its
  category at mint time (new `category` column on `unsubscribes`).
- GET confirmation page: performs the same category opt-out, then shows
  "You're unsubscribed from {category}" with three links: **Resubscribe**
  (reverses this opt-out), **Also stop announcements / digest** (opts out of
  the other category), and **Manage preferences**.
- Resubscribe and preference links on that page use a preferences token, not
  the one-shot unsubscribe token.

## Preferences token

New token type `preferences`, same HMAC-SHA256 scheme as unsubscribe, payload
`{ email, kind: 'preferences', t }`. TTL 180 days. Reusable; not stored or
claimed. Verification rejects payloads whose `kind` is not `preferences` so
unsubscribe tokens cannot be replayed against the preferences page and vice
versa.

Every email sent via `deliverToRecipients` includes a "Manage preferences"
link next to "Unsubscribe" in both HTML and plain-text footers.

## Preferences page

`GET /preferences?token=…`

- Invalid or expired token: 400 page with a short explanation.
- Recipient hard-suppressed (`active = false`): page explains that email to
  this address was disabled after a delivery problem and to contact the
  server admin. No form.
- Otherwise: form with two category checkboxes and one checkbox per library
  in `newsletter.include_libraries`. All libraries checked when `libraries` is
  null.

`POST /preferences` with token and form fields:

- Validates token and fields (schema-based). Unknown library names rejected.
- Upserts the `recipient_preferences` row. Selecting every library stores
  null.
- Re-renders the page with a saved confirmation.

Styling matches the existing unsubscribe page.

## Digest library filter

`renderFor` in the digest pipeline receives the recipient's `libraries`.
Sections not in the list are dropped before render. If nothing remains for
that recipient, the send is skipped and logged at info level with the reason
`no_matching_libraries`. Null means no filtering.

## Errors

- Token failures return 400 with a user-facing message; internals logged.
- Preference save failures return 500 with a generic message; internals
  logged.
- Webhook handlers keep current behaviour plus the reason column.

## Testing

Unit:
- Preferences token mint/verify, expiry, and kind mismatch rejection.
- Recipient filter for each category × preference × active combination.
- Unsubscribe claim sets only the token's category.
- Resubscribe refused when `suppressedReason` is set.
- Library filter drops sections and yields skip on empty.

Route:
- `GET /preferences` for invalid token, suppressed recipient, and normal.
- `POST /preferences` happy path, unknown library rejected, all-selected
  stores null.
- Unsubscribe GET/POST record category; confirmation page links present.

Pipeline:
- Digest run with one recipient opted out of digest, one with a library
  subset, one with an empty match: correct sends and skips.
