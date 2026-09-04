# tortuga.yml: portal reference

The optional `portal:` top-level key in `tortuga.yml` (`PortalConfigSchema` in
`src/kernel/config/schema.ts`) configures a small branded public site — a
"getting started" page, house rules, report-issue form, and a Plex link —
served on its own domain, separate from the newsletter/admin host. See
[Configuration overview](./index.md) for how this section's DB override
interacts with the file, and [Guide: the portal](../guide/portal.md) for what
end users see.

```yaml
portal:
  enabled: true
  domain: "plex.example.com"
  links:
    plex_url: "https://app.plex.tv"
    status_url: "https://status.example.com"
    request_url: "https://requests.example.com"
    request_label: "Make a request"
  pages:
    getting_started: { enabled: true }
    rules: { enabled: true }
    report_issue: { enabled: true }
  entries:
    - type: builtin_page
      page: getting_started
    - type: builtin_link
      link: plex
    - type: link
      label: "Wiki"
      url: "https://wiki.example.com"
    - type: page
      slug: "faq"
      label: "FAQ"
      markdown: "..."
  copy:
    tagline: "Welcome to {{server_name}}"
    footer: "Powered by {{server_name}}"
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `false` | Off 404s the portal on the public portal host. Admins still see the `/portal` preview (with a "disabled" banner) regardless of this setting. |
| `domain` | string | — | Host that serves the portal (see routing below). Required for the domain to actually route; the admin-host preview at `/portal` works regardless. |
| `links.plex_url` | url | `https://app.plex.tv` | "Go to Plex" button. |
| `links.status_url` | url | — | Optional server-status link. |
| `links.request_url` / `request_label` | url / string | falls back to `newsletter.extras.request_url` / `extras.request_label` | Optional request-service link. |
| `pages.<key>.enabled` | boolean | `true` | Toggles each built-in page (`getting_started`, `rules`, `report_issue`). |
| `pages.<key>.markdown` | string | — | Replaces the built-in page body entirely when set. |
| `pages.<key>.title` | string | see below | Overrides the page's `<h1>`/eyebrow context; falls back to the built-in title. |
| `pages.<key>.eyebrow` | string | see below | Small heading shown above the title. |
| `custom` | array | `[]` | Legacy custom-entry list; see "Legacy `custom`" below. |
| `entries` | array | the six built-ins below | The ordered home-index list. See "Home index entries" below. |
| `copy` | object | see "Chrome copy" below | Editable strings for the portal's chrome (tagline, footer, stuck-card text, etc). |
| `appearance` | object | inherits the newsletter's theme | Optional standalone theme (`theme` id + `theme_overrides`) for the portal's chrome. |

Per-page title/eyebrow defaults: `getting_started` → "Getting started" / "Guide",
`rules` → "House rules" / "Rules", `report_issue` → "Report an issue" / "Help".
Custom `page` entries always use their `label` as the title; their eyebrow comes
from `copy.custom_page_eyebrow`.

## Home index entries (`portal.entries`)

The home page renders one ordered list of rows. Each row is one of four types:

| type | fields | notes |
|---|---|---|
| `builtin_page` | `page` (`getting_started` \| `rules` \| `report_issue`), `label?`, `description?`, `hidden?` | Links to a built-in content page. Omitted automatically if that page is disabled. |
| `builtin_link` | `link` (`plex` \| `request` \| `status`), `label?`, `description?`, `hidden?` | Uses `portal.links.*_url`. `request`/`status` rows are omitted automatically when their URL is unset. |
| `link` | `label`, `url`, `description?`, `hidden?` | An external link. |
| `page` | `slug`, `label`, `markdown` or `html` (exactly one), `description?`, `hidden?` | A custom, slug-addressed page. Slugs must match `^[a-z0-9-]+$` and may not collide with a reserved path (`getting-started`, `rules`, `report-issue`, `portal`, `issues`, `api`, `_next`) or another entry's slug. |

- `label`/`description` are optional on `builtin_page`/`builtin_link` rows and fall
  back to the built-in copy (e.g. "Getting started" / "Accept the invite, install
  an app..."); set them to override just that row's text.
- `hidden: true` keeps a row's page/link reachable (it still serves at its slug or
  URL) but removes it from the home index. Rows are numbered by visible position,
  so hiding one renumbers the ones after it.
- Each built-in page and built-in link may appear **at most once** across the
  list — the schema rejects duplicate `builtin_page`/`builtin_link` entries.
- If `entries` is omitted entirely, the default list is used: `getting_started`,
  `rules`, `plex`, `request`, `status`, `report_issue` (in that order, all visible,
  subject to the same disabled-page/unset-URL omission rules above).
- **Legacy `custom`**: the older `custom` array (`type: link` / `type: page` only,
  no `hidden`) is still accepted for backward compatibility. When `entries` is
  unset, its rows are appended after the default list. It has no effect once
  `entries` is set. New configs should use `entries`; the admin UI always writes
  `entries`.

## Chrome copy (`portal.copy`)

All keys are optional strings; any key left unset falls back to the default text
below. Every string in `entries`, `pages.<key>.title`/`eyebrow`, and `copy` runs
through the same token substitution as page bodies (`server_name`, `plex_url`,
`request_url`, `request_label`, `status_url`). Page bodies additionally get
`report_issue_url`, which resolves to the portal's report-issue page (or to
`request_url` when that page is disabled); it depends on the request, so it is
not available in `entries`, `pages.<key>.title`/`eyebrow`, or `copy`.

| key | default |
|---|---|
| `tagline` | A private server for friends and family |
| `intro` | Everything you need to get set up, find your way around, and get help when something breaks. |
| `tab_title` | `{{server_name}}` |
| `toc_heading` | On this page |
| `stuck_title` | Something not playing? |
| `stuck_body` | Report an issue and include what you were trying to watch. |
| `stuck_link_label` | Report an issue |
| `back_label` | Back to index |
| `footer` | Powered by Tortuga |
| `custom_page_eyebrow` | Page |
| `show_stuck_card` | `true` (boolean) — hides the stuck card when `false`; also auto-hidden when the `report_issue` page is disabled |
| `show_footer` | `true` (boolean) — hides the footer when `false` |

## Host routing (`src/middleware.ts`)

The portal is served two ways:

- **Admin host, behind auth** — `/portal` and `/portal/<page>` on the normal
  admin domain, gated by the `(portal)` route group's own `layout.tsx`, which
  requires an admin session directly (not by the generic public-path check).
  This is for previewing as a logged-in admin.
- **Portal domain, public** — requests whose normalized `Host` header
  (port stripped, lowercased) matches `portal.domain` are routed by
  `handlePortalHost()` in `src/middleware.ts`: `/` → `/portal`, `/<page>` →
  `/portal/<page>` (single path segment matching `^/[a-z0-9-]+$`), rewritten
  with **no authentication** — that's the point, it's the public site.
  `/preferences` is additionally allowed (GET/HEAD/POST) so mailed preference
  links work from any network. Every other path on that host — admin/API
  routes, nested paths, non-GET/HEAD requests, and any request carrying a
  `Next-Action` header (React server-action dispatch) — 404s; the portal
  domain never serves anything else.

Two header-stripping guarantees matter for security:

1. Middleware strips the configured forward-auth header (`AUTH_FORWARD_HEADER`,
   default `Remote-User`) from the request before rewriting to the portal, so a
   client can't forge it to reach code that trusts it downstream.
2. Every `NextResponse.next()`/rewrite in this file strips the internal
   `PORTAL_HOST_HEADER` marker from the *inbound* request first — that header
   is only ever set by middleware itself when routing a genuine portal-domain
   request, never trusted if a client sends it directly.

`getPortalHostConfigFresh()` (`src/kernel/context.ts`) — not the cached
`AppContext` — backs this check, re-reading the DB override (or YAML) at most
once every 5 seconds (`PORTAL_HOST_CONFIG_TTL_MS`), so a Settings save/revert
becomes visible to middleware without depending on cross-module context
invalidation.

## Ops checklist (deploying a portal domain)

Getting `domain` live requires infrastructure changes outside the app —
config alone will not route real traffic:

1. **Cloudflare Tunnel** (or equivalent): add a public hostname for the portal
   domain pointing at the same origin (reverse proxy) as the admin app.
2. **Reverse proxy** (e.g. Traefik): add a router/host rule for the portal
   domain to the same service as the main app. **The proxy chain must
   preserve the original `Host` header end-to-end.** Host-based routing here
   reads the inbound `Host` header directly — it does **not** consult
   `X-Forwarded-Host` — so a proxy that rewrites `Host` (e.g. terminating TLS
   and re-issuing the request under a different host) will make the portal
   fail closed (404 everywhere on that domain) rather than accidentally
   exposing admin routes.
3. **Forward-auth (e.g. Authelia)**: add a bypass rule scoped to the portal
   domain **only** — do not widen an existing admin-host bypass rule to cover
   it. Forward-auth is the only thing standing between the public internet and
   the middleware guard described above for that host.
4. Verify: `enabled: true` + `domain` set on the top-level **Portal** nav page
   (`/portal-settings`), then load the
   domain in a private/incognito window (no session cookie) and confirm the
   home page renders, while an admin-only path like `/settings` on that same
   domain 404s.

## Related

- [Configuration overview](./index.md)
- [tortuga.yml: newsletter reference](./tortuga-yml.md)
- [Guide: the portal](../guide/portal.md)
