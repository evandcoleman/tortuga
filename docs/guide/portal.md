# Portal

The portal is Tortuga's public-facing side: a small set of pages your Plex
users visit directly, served on your own domain, separate from the
authenticated admin app. This page covers what end users see and where an
admin configures it; for the full field-by-field config reference see
[Portal configuration](../configuration/portal.md).

## What end users see

- **Home** (`/portal`, or the portal root on the configured domain) — the
  server name, a tagline/intro, and a list of entries: built-in pages, custom
  pages, and external links, each rendered as a numbered row.
- **Getting started** (`/portal/getting-started`) — a built-in page (content
  editable/overridable in admin) meant to walk a newly-invited user through
  installing Plex and connecting.
- **Rules** (`/portal/rules`) — a built-in page for server rules/etiquette.
- **Report issue** (`/portal/report-issue`) — a built-in page for "something
  not working" — see [Announcements](./announcements.md) for how requests get
  to you; this page is just static/markdown content, not a ticketing system.
- **Custom pages** (`/portal/[slug]`) — admin-authored pages, each either
  markdown (goes through the same token-substitution + markdown pipeline as
  the built-ins) or raw HTML (rendered verbatim, since it's admin-authored and
  trusted).

Every built-in and custom page can reference the server name and other
portal variables via `{{token}}` substitution in its markdown body — the same
substitution engine used by [templates](./announcements.md#templates-library).

## How admins configure it

`/portal-settings` edits the `portal` section of config: enabling/disabling
built-in pages, overriding their title/markdown, adding custom link/page
entries, portal-wide copy (tagline, intro, footer, etc.), and portal-specific
appearance (theme + overrides, distinct from the newsletter's theme). A
**Preview portal** link on the settings page opens `/portal` directly.

## Domain requirement

The portal's own pages resolve at `/portal/*` on the admin domain by
default, but its intended deployment is on a **separate public domain**
(`portal.domain` in config) via host-based routing in `src/middleware.ts`:
when a request's `Host` header matches the configured portal domain, the
middleware rewrites `/` and any single-segment path (`/[a-z0-9-]+`) to the
matching `/portal/*` route and marks the request as portal-origin. Any other
path on that host (admin routes, API routes, nested paths) 404s — the portal
domain never serves anything except the portal.

Because the portal domain is meant to be public, authentication is bypassed
entirely for requests that land on it (paired with bypassing your reverse
proxy's forward-auth for that hostname specifically — see
[Portal configuration](../configuration/portal.md) for the exact setup).

## Related

- [Portal configuration reference](../configuration/portal.md)
- [Announcements](./announcements.md)
- [Invites](./invites.md)
