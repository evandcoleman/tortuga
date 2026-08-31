# Invites & Welcome Onboarding

Roadmap item #1, plus the core of item #5 pulled forward: send Plex invites
from Tortuga and fire a templated welcome email, backed by a new reusable
message-templates module with a UI editor.

## Decisions (from brainstorm)

- Tortuga **sends** invites via the plex.tv API (not detect-only).
- Welcome email goes out **at invite time**, to the invited address — it
  doubles as the how-to-accept guide. No accept-state tracking.
- Users invited **outside** Tortuga (straight through Plex) are flagged
  "not welcomed" by the existing Tautulli sync; admin sends their welcome
  manually per-user. Never auto-send.
- Welcome content is a **full UI-editable template** (markdown +
  `{{variables}}`) stored in the DB — the first template in a general
  templates module that item #5 later extends (drafts, clone, library).
- Library selection per invite: checkboxes, default all.
- Plex token joins the existing YAML config pattern.

## Phase 1 — Templates module

New module `src/modules/templates/` following existing module conventions.

**Schema** (`templates` table): `id`, `slug` (unique), `name`, `subject`,
`body` (markdown with `{{variables}}`), `createdAt`, `updatedAt`. A default
`welcome` template is seeded on first startup (accept steps, apps to
install, request-content pointer, house-rules placeholder) and is editable
but not deletable.

**Rendering**: markdown body → HTML inside the existing React Email
chrome/appearance theming (same wrapper the announcements pipeline uses),
plus the plain-text alternative per the email-hygiene work. Variable
substitution before markdown rendering. Supported variables: `{{name}}`,
`{{email}}`, `{{server_name}}`. Unknown variables render as-is (no crash);
`{{name}}` falls back to the email local part when no name is known.
Subject supports the same variables.

**UI**: "Templates" page in the Messages sidebar section — list, edit
(subject + markdown body, variables documented inline), live preview via a
preview endpoint reusing the announcement preview pattern.

**API**: CRUD routes under `/api/templates` (admin-authed like existing
routes), plus `POST /api/templates/:slug/preview`.

## Phase 2 — Plex client + invites

**Config**: `plex.token` added to the YAML schema (optional; invites UI
shows a setup notice when absent). Reuses existing `plex.server_id` as the
machine identifier. Validated at startup like other config.

**Plex client** (`src/kernel/integrations/plex.ts`), talking to plex.tv
with `X-Plex-Token` + `X-Plex-Client-Identifier`:

- `getSections()` — fetch the server's library sections **with their
  plex.tv global IDs** via `GET https://plex.tv/api/servers/{machineId}`.
  Local section keys are NOT valid `librarySectionIds`; the mapping lives
  here (see python-plexapi `_getSectionIds` for the reference behavior).
- `invite(email, sectionIds)` — `POST https://plex.tv/api/v2/shared_servers`
  with `{machineIdentifier, librarySectionIds, invitedEmail}`.
  422 means already invited/shared — surface as a friendly duplicate error.
- `getPendingInvites()` / `cancelInvite(id)` — list and revoke outstanding
  invites so the UI reflects reality.

All calls validated/parsed at the boundary (zod), errors logged with
context and returned as typed failures — never thrown raw into routes.

**Schema**: new `invites` table: `email` (PK), `sectionIds` (json),
`sentAt`, `welcomeSentAt` (nullable), `status` (`pending` | `accepted` |
`cancelled`). `recipientsCache` gains `welcomedAt` (nullable timestamp).
Migration backfills `welcomedAt = now()` for all existing recipients —
pre-feature users are grandfathered, so rollout produces zero
"not welcomed" flags.

**Invite flow** (`POST /api/invites`): validate email → Plex `invite()` →
upsert `invites` row (re-inviting a cancelled email resets the row) → render `welcome` template → send via the configured
provider (same send path as announcements, including plain-text part) →
set `welcomeSentAt`. If the Plex invite succeeds but the email send fails,
the invite row persists with `welcomeSentAt` null and the UI offers
"resend welcome" — never roll back the Plex invite.

**Sync integration**: when the Tautulli sync inserts a *new* recipient, it
checks `invites` by email — match ⇒ mark invite `accepted` and copy
`welcomeSentAt` to `welcomedAt`; no match ⇒ recipient has `welcomedAt`
null (externally invited, shows as "not welcomed").

**UI**: "Invites" page in the Messages sidebar section:

- Invite form: email + library checkboxes (from `getSections()`, all
  checked by default) + send.
- Pending invites list (from `invites` + `getPendingInvites()`), with
  cancel and resend-welcome actions.
- Recipients page: "not welcomed" badge on rows with `welcomedAt` null and
  a per-row "Send welcome" button (renders `welcome` template with the
  recipient's real name, sets `welcomedAt`). Skips deactivated recipients.

The welcome email is transactional — no `List-Unsubscribe` headers, but it
is never sent to a deactivated (bounced/complained/unsubscribed) address.

## Testing

TDD throughout. Unit: variable substitution (fallbacks, unknown vars),
markdown → React Email rendering, section-ID mapping, invite-flow branches
(Plex 422, email-send failure leaves invite intact). Integration: template
CRUD + preview routes, invite route against a mocked Plex client, sync
marking accepted/not-welcomed. Existing guard tests (use-server re-export)
must stay green.

## Out of scope

Accept-state polling / second-stage emails, auto-welcome of externally
invited users, template drafts/clone/library UI (item #5), invite
reminders, removing shares/users, managed/home users (invite by email
only).
