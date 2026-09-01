# User Portal

Roadmap #2. A small set of opinionated, templated public pages that replace hand-rolled
portal sites like plex.example.com. Not a CMS.

## Goal

Friends/family land on a branded public site (e.g. `plex.example.com`) served by Tortuga
itself: a home page of big link buttons plus three content pages. Content ships with
sensible built-in copy, personalized via config variables, optionally overridden per page
with a markdown blob. The welcome/invite emails (#1) link to it.

## Serving model (host-routed)

- Portal routes live in the app under a `(portal)` route group at internal paths
  `/portal`, `/portal/getting-started`, `/portal/rules`, `/portal/report-issue`.
- Middleware: when the request `Host` matches the configured `portal.domain`, rewrite
  `/` → `/portal`, `/<page>` → `/portal/<page>`, and treat the request as public (no
  `Remote-User` / session requirement). All other paths on the portal host 404 —
  admin and API routes are never served on the portal domain (except static/_next assets).
- On the admin host, `/portal/*` remains reachable behind normal auth as a live preview.
- If `portal.enabled` is false (default), portal routes 404 everywhere and the host
  rewrite is inert.

### Ops (deploy-time, not code)

- Cloudflare tunnel + Traefik router: add the portal domain as a host for the tortuga
  service.
- Authelia (edge node config): bypass rule for the portal domain.
- Documented in the spec's rollout notes / docs/CONFIG.md, applied in the olympus repo.

## Pages

All pages render server-side from config. Theme-aware chrome shared via a portal layout:
server name as title, minimal footer, no admin nav.

1. **Home (`/`)** — button grid, button-grid style. Buttons in order, each rendered only
   when its target is enabled/configured:
   - Getting Started → `/getting-started` (page enabled)
   - Rules → `/rules` (page enabled)
   - Go to Plex → `portal.links.plex_url` (default `https://app.plex.tv`)
   - Make a Request → `portal.links.request_url` (defaults from `extras.request_url`)
   - Server Status → `portal.links.status_url`
   - Report an Issue → `/report-issue` (page enabled)
2. **Getting Started (`/getting-started`)** — default copy: invite → install app →
   pick server `{{server_name}}` → stream; includes "Recommended devices" and
   "Here for music? (Plexamp)" sections.
3. **Rules (`/rules`)** — default copy: generic house rules (share-with-household-only,
   report broken files, request freely, report missing episodes).
4. **Report an Issue (`/report-issue`)** — default copy: content issues go through the
   request service's Report Issue flow (links `portal.links.request_url`); no form,
   no backend. Path avoids colliding with `/issues/[slug]` (hosted newsletter issues).

### Content model

- Default copy is built-in (markdown strings in the portal module), rendered through the
  existing `substituteVariables` + `marked` pipeline. Variables: `{{server_name}}`,
  `{{request_url}}`, `{{request_label}}`, `{{status_url}}`, `{{plex_url}}`.
- Per page, an optional `markdown` config value **replaces** the default body entirely
  (title/chrome stays). No append mode.
- Per page, `enabled` flag (default true).

## Config

New top-level `portal:` section in YAML, mirrored by a DB override:

```yaml
portal:
  enabled: true
  domain: plex.example.com
  links:
    plex_url: https://app.plex.tv      # default
    request_url: https://request…      # defaults from extras.request_url
    request_label: Overseerr           # defaults from extras.request_label
    status_url: https://status…        # optional; button hidden if unset
  pages:
    getting_started: { enabled: true, markdown: null }
    rules:           { enabled: true, markdown: null }
    report_issue:    { enabled: true, markdown: null }
  appearance:                          # optional; falls back to newsletter appearance
    theme: editorial
    theme_overrides: { … }             # same ThemeOverridesSchema as newsletter
```

- Zod schema in `src/kernel/config/schema.ts` alongside the newsletter schema; all
  fields optional with defaults so an absent `portal:` section is valid (disabled).
- **Override storage**: generalize `config_overrides` to section-keyed rows: migration
  (via `drizzle-kit generate`) adds a `section` column and backfills the existing row 1
  as `newsletter`. Resolution per section: DB override ?? YAML ?? defaults.
- `server_name` comes from the existing Plex config, as elsewhere.

## Admin UI

New `(admin)` page **Settings → Portal** (placement consistent with existing settings
nav): enable toggle, domain, link fields, per-page enable + markdown editor, theme
picker (inherit-from-newsletter default or explicit theme + overrides, reusing the
existing appearance editor components where practical), and a "Preview portal" link to
`/portal`. Saves via the section-keyed config override.

## Theming

- `resolvePortalTheme()`: `portal.appearance` if set, else the newsletter's resolved
  theme (preset + overrides). Output feeds CSS variables (palette, fonts) on the portal
  layout. Portal page chrome is its own web design (responsive button grid, prose
  pages) — it does not reuse the email shell components.

## Non-goals

- No CMS: no arbitrary pages, no WYSIWYG, no media uploads.
- No forms or public POST endpoints; report-an-issue is instructions only.
- No per-user content, auth'd user area, or analytics.
- No automatic DNS/tunnel/Authelia provisioning.

## Testing

- Config: portal schema defaults, section-keyed override resolution (DB ?? YAML ??
  defaults), link fallbacks from `extras`.
- Middleware: portal-host rewrite + public access; non-portal paths 404 on portal host;
  admin host unaffected; disabled portal 404s.
- Theme: inherit vs explicit portal appearance.
- Rendering: default copy variable substitution; markdown override replaces body;
  disabled page hides button and 404s.
