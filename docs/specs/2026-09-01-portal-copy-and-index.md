# Portal: editable copy and a unified home index

Date: 2026-09-01. Extends the user portal spec (2026-08-31).

## Goal

Every piece of text the portal renders is editable from Portal → Settings, and the
home index rows can be reordered and hidden. Defaults stay exactly what ships today,
so an untouched config renders unchanged.

## 1. Home index: one ordered list

`portal.custom` is replaced by `portal.entries`, an ordered array. Four entry types:

| type | fields | notes |
|---|---|---|
| `builtin_page` | `page` (getting_started \| rules \| report_issue), `label?`, `description?`, `hidden?` | Links to the built-in page. Row is omitted if the page is disabled. |
| `builtin_link` | `link` (plex \| request \| status), `label?`, `description?`, `hidden?` | Uses `portal.links.*_url`. `request`/`status` rows are omitted when their URL is unset. |
| `link` | as today (`label`, `url`, `description?`) plus `hidden?` | unchanged |
| `page` | as today (`label`, `slug`, `markdown` xor `html`, `description?`) plus `hidden?` | unchanged; hidden pages still serve at their slug |

- `label`/`description` on built-in entries are optional and fall back to today's copy.
- Each built-in (`page` × 3, `link` × 3) may appear at most once. Validation rejects duplicates.
- Rows are numbered by visible position, so hiding a row renumbers the ones after it.
- **Default list** (used when `entries` is absent): getting_started, rules, plex, request, status, report_issue.
- **Legacy `custom`**: still accepted by the schema. Resolution is
  `entries ?? [...DEFAULT_ENTRIES, ...custom]`. The admin form always writes `entries`;
  the example YAML and CONFIG.md switch to `entries`.

## 2. Built-in page copy

`portal.pages.<page>` gains `title?` and `eyebrow?` next to `enabled` and `markdown`.
Defaults: Getting started / Guide, House rules / Rules, Report an issue / Help.
Custom pages keep `label` as title; their eyebrow comes from `portal.copy.custom_page_eyebrow`.

## 3. Chrome copy: `portal.copy`

All optional strings, default = current hard-coded text:

| key | default |
|---|---|
| `tagline` | A private server for friends and family |
| `intro` | Everything you need to get set up, find your way around, and get help when something breaks. |
| `tab_title` | `{{server_name}}` |
| `toc_heading` | On this page |
| `stuck_title` | Stuck? |
| `stuck_body` | Report an issue and include what you were trying to watch. |
| `stuck_link_label` | Report an issue |
| `back_label` | Back to index |
| `footer` | Powered by Tortuga |
| `custom_page_eyebrow` | Page |

Two booleans, both default `true`: `show_stuck_card`, `show_footer`. The stuck card is
also suppressed automatically when the report_issue page is disabled (as now).

## 4. Tokens

Every string above (entry labels/descriptions, page titles/eyebrows, all `copy` keys)
runs through the existing token substitution with the same variables as page bodies
(`server_name`, `plex_url`, `request_url`, `request_label`, `status_url`). Output is
escaped as text; tokens do not inject HTML.

## 5. Resolution

`resolvePortalConfig` returns fully-resolved `entries` (defaults applied, built-ins
mapped to hrefs, unset-URL and disabled-page rows dropped, hidden rows dropped) and a
resolved `copy` object. Rendering code reads only resolved values; no component keeps
its own fallback string. `home-buttons.ts` collapses into this resolution step.

## 6. Admin UI (Portal → Settings)

- **Home**: tagline, intro, then an **Index** editor replacing CustomEntriesEditor.
  One list, drag-free reordering via up/down buttons, a visibility toggle per row,
  and a type badge. Built-in rows expose label + description only and cannot be
  deleted (hide instead). Custom rows keep their current fields. "Add" offers
  external link, page, and any built-in row missing from the list.
- **Pages**: per built-in page, enabled + title + eyebrow + markdown override.
- **Copy**: tab title, TOC heading, stuck card (show toggle, title, body, link label),
  back label, footer (show toggle, text), custom-page eyebrow.
- Every optional field shows its default as the placeholder; blank means "use default".
- Save/revert semantics unchanged (section-keyed DB override, revert returns resolved config).

## 7. Non-goals

- Drag-and-drop ordering.
- Per-page custom eyebrows or icons for custom entries.
- Localisation beyond single-string overrides.
- Editing the admin-only disabled-preview banner.

## 8. Testing

- Schema: legacy `custom` accepted; duplicate built-ins rejected; hidden/ordering round-trip.
- Resolution: default list matches today's six rows; legacy custom appended after defaults;
  disabled page and unset URL rows dropped; hidden rows dropped; numbering follows visibility;
  tokens substituted in labels and copy.
- Render (renderToStaticMarkup): home shows configured order/labels; content page shows
  configured title/eyebrow/TOC heading/stuck card/back label; footer hidden when
  `show_footer` is false.
- Admin validate: form → config mapping for entries, pages, copy; blank fields omit keys.
