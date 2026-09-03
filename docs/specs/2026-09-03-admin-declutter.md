# Admin UI declutter

Date: 2026-09-03
Status: draft, awaiting approval

## Goal

Reduce visual density across the admin UI without removing any function. The route map stays as-is except for the Newsletter Overview page, which is removed.

## Rules (apply everywhere)

1. **Titles only.** No page-level `description` on `PageHeader`. No `CardHeader` descriptions. A card is a title plus its content.
2. **Hints stay only where the label is not enough.** A field hint survives only if it discloses format, a conditional requirement, or non-obvious behavior. The keep list below is exhaustive; anything not listed is removed.
3. **No nav links that duplicate the sidebar.** Header buttons/links that just go to a sidebar destination are removed. Contextual links that lead somewhere the sidebar does not (a detail row, "See all" under a truncated list, external preview) stay.
4. **Eyebrow matches the sidebar group.** Dashboard: "Overview". Newsletter pages: "Newsletter". Messages pages: "Messages". People pages: "People". Portal: "Portal". Alerts and Settings: "System".
5. **No explainer cards.** Cards whose content is instructional prose or a link are removed.

The `description` props on `PageHeader` and `CardHeader` remain in `ui.tsx`; pages simply stop passing them where this spec says.

## Sidebar (`sidebar.tsx`)

- Remove the "Overview" group header. Dashboard becomes a single top-level item above the grouped sections.
- Remove Newsletter → Overview.
- Remove the status card (Online / Provider / Auth). User email and Sign out stay.
- Resulting nav: Dashboard · Newsletter (Preview, Customize, History) · Messages (Compose, History, Templates) · People (Recipients, Invites, Portal) · System (Alerts, Settings).

## Newsletter Overview (`/newsletter`)

- Delete the page. Add a redirect from `/newsletter` to `/newsletter/preview` so bookmarks keep working.
- Retarget any in-app links to `/newsletter` (grep) to `/newsletter/preview`.

## Dashboard (`/`)

- Title: "Dashboard" (was "Welcome aboard."). Remove description.
- Header actions: keep "Open preview" (primary). Remove "View history".
- Keep: alerts panel, setup banner, the 4 stat tiles, Recent digests card (remove its description; keep "See all →").
- Remove: Pipeline card, Lifetime totals card. Recent digests spans the full width.

## Newsletter Preview (`/newsletter/preview`)

- Remove description. Keep Generate button, Issue URL copy, the 3 tiles, preview iframe.
- Empty state body becomes one line: "Generate a preview to render the next issue as a dry run." Remove the "Renders the same HTML recipients will see" note.

## Newsletter Customize (`/newsletter/customize`)

- Remove description. Keep the Blocks hint "Drag to reorder, toggle visibility." Section headers unchanged.

## Newsletter History (`/newsletter/history`)

- Remove description. Table unchanged.

## Messages Compose (`/messages`)

- Remove description and the "View history" link.
- ScheduledList card: remove description.

## Message History (`/messages/history`, `/messages/history/[id]`)

- List: remove description and "← Compose". Eyebrow → "Messages".
- Detail: remove description and back-link(s). Keep retry actions and the recipient table.

## Scheduled message (`/messages/scheduled/[id]`)

- Remove description and "← Back to messages". The Cancel action in the composer stays visible.

## Templates (`/messages/templates`, `/messages/templates/[slug]`)

- List: remove description and "← Compose". The System badge is the only signal that the welcome template is locked.
- Editor: remove PageHeader description, Content description, Variables description, Save description. Keep Delete description (system-template lock). Keep per-variable list and the preview placeholder.

## Alerts (`/alerts`)

- Remove description. Eyebrow → "System". Table and "Acknowledge all" unchanged.

## Recipients (`/people/recipients`)

- Remove description.
- Stats: keep Active, Manual, Not welcomed, Unsubscribed. Remove the Not-welcomed hint text. Remove the Last sync tile; render "Synced from Plex {relative} · {n} cached" as one muted line directly above the table.
- Merge Add and Import into one card titled "Add recipients": a single textarea plus one "Add" button. Input is one recipient per line as `email` or `email, Name`; commas between whole entries are still accepted. Uses the existing import parser and action; the separate single-email action is removed. One hint under the textarea: "One per line: email, or email, Name".
- Table unchanged.

## Invites (`/people/invites`)

- Remove description and the "How it works" card entirely. The not-configured empty state stays.

## Portal settings (`/portal-settings`)

- Remove page description and the inline "Preview portal →" link (header link stays).
- Remove card descriptions on Links, Home, Appearance.
- Keep as hints: Domain tunnel/Authelia note, Enable-portal note, Pages override note, Copy note, per-page notes in the built-in pages list.

## Settings

- Layout: remove the "Changes are saved… no restart needed" description. Keep tabs and "Revert to file default".
- General: remove the Appearance card. Remove Schedule and Plex card descriptions. Keep cron hint "e.g. 0 9 * * SUN" and the schedule-enabled hint. Server ID hint becomes one line: "Powers 'Open in Plex' links. Find it under Plex Settings → General."
- Content: remove Filters, Commentary, Extras descriptions. Keep Leaving soon (Maintainerr) description as the card's hint. Keep field hints: "Blank = uncapped.", "Comma or newline separated.", "Blank = all libraries.", "Blank uses the provider default.", disclaimer hint. Remove the Voice hint.
- Email: remove all three card descriptions. Keep "Required when provider is Mailgun." and both webhook hints.
- Services: remove Tautulli, TMDB, Maintainerr descriptions. Anthropic and OpenAI keep a one-line hint "Used when Commentary provider is Anthropic/OpenAI." Placeholders stay.

## Out of scope

- Any route merge beyond removing Newsletter Overview.
- Table column changes.
- Styling or theme changes.

## Testing

- Unit: merged recipients form parses `email` and `email, Name` lines and comma-separated entries; single-email add path removed and its tests deleted or folded in.
- Unit/route: `/newsletter` redirects to `/newsletter/preview`; sidebar renders no Overview group and no `/newsletter` link.
- Existing form and page tests updated for removed props; no test asserts on removed copy.
- Manual: every admin page renders in the local seeded instance (scratchpad `ui-audit`) with no console errors; screenshots re-taken for before/after.
