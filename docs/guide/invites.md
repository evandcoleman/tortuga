# Invites

`/people/invites` sends Plex library invites straight from Tortuga and
follows them up with a welcome email — no more separately emailing new users
after inviting them on plex.tv.

## Prerequisites

The page shows an "Plex isn't configured" empty state until both of these are
set:

- **`PLEX_TOKEN`** env var — a Plex account token with access to your server.
- **`newsletter.plex.server_id`** in [tortuga.yml](../configuration/tortuga-yml.md).

An email provider (Resend or Mailgun) must also be configured — see
[Email providers](./email-providers.md). Without one, the invite is refused
outright with `409 No email provider is configured` before Plex is contacted.

## Invite flow

`createInvite()` (`src/modules/invites/invite-flow.ts`) runs, in order:

1. **Refuse deactivated addresses** — if the email is already in the
   recipients cache and `active: false` (suppressed — see
   [Recipients](./recipients.md)), the invite is refused before ever hitting
   Plex.
2. **Send the Plex invite** — via the Plex API, granting access to the
   selected library sections. A duplicate invite or any other Plex API error
   is surfaced to the admin without touching local state.
3. **Record the invite locally** — a `pending` row is written (or reset to
   `pending` with a fresh timestamp, even if it was previously
   `cancelled` — a fresh plex.tv invite always resets local status).
4. **Send the welcome email** — renders the `welcome` template (see
   [Announcements — Templates library](./announcements.md#templates-library))
   with `{{name}}` / `{{email}}` / `{{server_name}}` substituted, and sends it
   directly through the configured provider. This is a transactional send: no
   unsubscribe link, no `List-Unsubscribe` headers, and it is not recorded in
   message history.

If the Plex invite succeeds but the welcome email fails, **the Plex invite is
never rolled back** — the invite row stays `pending` with `welcomeSentAt`
unset, and the admin can retry via **Resend**.

## Library selection

The invite form lists every Plex library section (`plex.getSections()`) as
checkboxes; the admin picks which sections the new invite grants access to.

## Pending list

The table on `/people/invites` is built from Plex's own pending-invites
endpoint (`plex.getPendingInvites()`), cross-referenced with Tortuga's local
`invites` rows for section IDs and timestamps — plex.tv's endpoint doesn't
report which sections a pending invite covers, so that detail is only shown
for invites that went through Tortuga. An invited user disappears from this
list automatically once they accept on plex.tv (Tautulli's next sync then
picks them up as a recipient and marks the local invite `accepted`).

## Resend

**Resend** re-sends only the welcome email (not the Plex invite) for an
existing invite. It works even for invites created outside Tortuga, as long
as the address currently shows up as pending on plex.tv. It refuses to send
to a deactivated recipient.

## Related

- [Recipients](./recipients.md)
- [Announcements](./announcements.md)
- [tortuga.yml reference](../configuration/tortuga-yml.md)
