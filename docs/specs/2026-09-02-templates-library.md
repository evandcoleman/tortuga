# Transactional templates library

Roadmap item 5. The template engine (DB rows, `{{name}}`/`{{email}}`/
`{{server_name}}` substitution, admin editor) shipped with item 1. This adds
the library on top: seeded templates, send-from-template in compose, and
clone-previous-send from history.

## Decisions

- **Compose stays announcement-only.** A template sent from compose is an
  announcement: preferences and suppression apply, unsubscribe links are
  present. No transactional toggle.
- **No drafts.** Scheduling (item 4) and saving a template cover the need.
- **Variables substitute per recipient for every announcement**, not only
  ones started from a template. Anyone typing `{{name}}` into compose gets
  the substitution.
- **Seeds are one-shot per slug.** A deleted library template does not
  come back on the next boot.

## Seeded templates

New `src/modules/templates/library-content.ts` exporting three templates.
Copy is a starting point the admin edits; keep it short and neutral.

| slug | name | subject |
|---|---|---|
| `server-back-up` | Server is back up | `{{server_name}} is back online` |
| `password-help` | Password help | Resetting your Plex password |
| `removal-notice` | Removal notice | Your access to `{{server_name}}` |

Bodies use `{{name}}` in the greeting and `{{server_name}}` where the
server is named. Password help links to `https://www.plex.tv/sign-in/password-reset/`.
Removal notice states access ends, thanks them, and invites a reply.

`seedWelcomeTemplate` becomes `seedDefaultTemplates(db)` over a
`DEFAULT_TEMPLATES` list (welcome plus the three above). The welcome row
keeps its current `ON CONFLICT DO NOTHING` semantics and remains the only
undeletable "System" template.

Library seeds are tracked in a new table so deletion sticks:

```
template_seeds: slug text primary key, seeded_at integer not null
```

For each library template: if a `template_seeds` row exists, skip;
otherwise insert the template (`ON CONFLICT DO NOTHING` on slug) and the
seed row in one transaction. Migration generated with `drizzle-kit
generate`. Welcome is not tracked here; its existing behaviour is unchanged.

## Variable substitution in announcements

`src/modules/announcements/pipeline/send.ts`:

- The per-recipient render passed to `deliverToRecipients` substitutes
  subject and body with `{ name: recipient.name, email: recipient.email,
  serverName: config.from.name }` via `substituteVariables` before markdown
  rendering.
- `DeliverToRecipientsArgs.subject` widens to `string | ((recipient:
  DeliverRecipient) => string)`; `deliverToRecipients` resolves it per
  recipient. Digest callers keep passing a string.
- Preview (`dryRun`) substitutes `{ name: 'Preview', email:
  'preview@tortuga.local', serverName }`.
- Test send substitutes with the admin's email and `name: null` (falls back
  to the email local part).
- `announcements.subject` and `body` store the raw text with tokens.
  `renderedHtml` stores the preview render, as today.

The scheduled path (`run-due.ts`) inherits this through the shared delivery
helper; no change there.

## Send-from-template in compose

- `/messages` page loads `listTemplates(db)` and passes `templates: {
  slug, name, subject, body }[]` to the composer.
- Composer gains a "Start from a template" select above the subject field,
  with a "Manage templates" link to `/messages/templates`. Choosing a
  template fills subject and body. If either field is non-empty and
  differs from the last applied template, confirm "Replace the current
  subject and body?" first. Applying is one-way; later edits do not touch
  the template.
- A hint under the body field lists the available variables.
- The select is available in edit mode too.

## Clone previous send

- History detail (`/messages/history/[id]`) gets a "Use as starting point"
  link to `/messages?from=<id>`.
- `/messages` reads `from`. If an announcement with that id exists (any
  status), the composer is prefilled with its subject, body, and recipient
  emails intersected with the active list. An unknown id renders the blank
  composer; no error.
- Composer prop shape: `initial?: { subject, body, recipientEmails }` for
  prefill, `editing?: { id, wallClock }` for edit mode. The edit route
  passes both. This replaces the current `editing` prop that carries the
  content fields.

## Error handling

- Seeding failures throw at boot, as today.
- A template deleted between page load and selection only affects the
  in-memory list; nothing server-side depends on it.
- A `from` id that no longer exists is ignored.

## Testing (vitest, `pnpm test`)

- `seed.test.ts`: all four seeded on empty DB; second run inserts nothing;
  deleting `password-help` then re-seeding does not restore it; an edited
  welcome row is untouched.
- `send.test.ts`: two recipients receive different `{{name}}` in body and
  subject; preview uses the sample values; test send falls back to the
  local part; `{{server_name}}` resolves to `config.from.name`.
- `deliver.test.ts`: function-valued subject is resolved per recipient.
- A pure `cloneSource(db, id)` helper with tests: returns prefill for an
  existing row, null for unknown, filters recipients to active.

## Out of scope

Drafts, a transactional or per-send category toggle, template categories or
tags, editing templates from inside the composer, request-fulfilled or
lifecycle automations.
