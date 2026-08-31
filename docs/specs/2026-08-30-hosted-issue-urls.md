# Hosted Issue URLs + Per-Section Item Limits

**Date:** 2026-08-30
**Status:** Approved

## Goal

Each sent newsletter gets a hosted web URL so recipients can view it in a browser. Email sections are capped by configurable per-section limits; when a section is truncated, the email shows a "View all N →" link to the web version, which always shows every item.

## Access model

Anyone with the link. URLs use an unguessable random slug; no auth, no index/archive page, 404 for unknown slugs.

## Design

At digest run time, render **two variants** from the same in-memory items:

1. **Email HTML** — per-section caps applied, "View this issue online" link, "View all N →" links on truncated sections. Stored in `digests.rendered_html` (unchanged column).
2. **Web HTML** — same template, no caps, light web chrome, section anchors, no unsubscribe line. Stored in new `digests.web_html` column.

The issue page is an immutable snapshot: library contents drift after send, so we serve stored HTML rather than re-rendering.

### Schema (drizzle, via `drizzle-kit generate`)

- `digests.slug` — text, unique, NOT NULL for new rows (nullable in migration for existing rows; old digests get no web URL). Generated at digest creation: 16 random bytes, base64url.
- `digests.web_html` — text, nullable.

### Caps move from filters to render

- `filters.ts` no longer slices library sections (`max_items_per_section` slice at filters.ts:64 removed). Full item lists flow to the renderer and into the web variant.
- `DigestEmail` gains a `limits?: { perLibrarySection?: number; leavingSoon?: number }` prop and an `issueUrl?: string` prop.
  - When a section has more items than its limit, it renders the first N and a "View all {total} →" link to `{issueUrl}#{section-anchor}`.
  - Web render passes no `limits` (and no unsubscribe URL) but does pass anchors.
- "View this issue online" link renders at the top of the email (above the intro) when `issueUrl` is set.

### Config

In the `filters` config section (settings → Content form):

- `max_items_per_section` — unchanged key, still applies to **each** library section. Default 12.
- `max_items_leaving_soon` — new, optional positive int. Empty/unset = uncapped (today's behavior).

One knob covers all library sections (they're dynamic per-library); no per-library knobs.

### Public route

- `app/issues/[slug]/page.tsx` (outside the `(admin)` group): looks up digest by slug where `web_html` is not null and status is `sent` (or `rendered`, so preview-then-send flows work), returns stored HTML; `notFound()` otherwise.
- `middleware.ts`: add `/issues` to the public-paths allowlist.
- Absolute URLs built from existing `APP_URL` env, same as unsubscribe links.

### Unsubscribe / per-recipient content

Per-recipient unsubscribe tokens remain email-only (injected in deliver step as today). The web variant contains no unsubscribe link and no recipient-specific content.

### Admin surfacing

The admin newsletter/preview area shows the issue URL (copyable) for digests that have one.

## Testing

- Unit: slug generation (length, uniqueness of encoding, URL-safe); `DigestEmail` limits — section sliced at N with "View all N →" link present and correct href/anchor; no link when under limit; leaving-soon capped only when `max_items_leaving_soon` set; web variant renders all items, no unsubscribe.
- Route: `/issues/[slug]` publicly accessible (no auth), serves stored HTML; unknown slug → 404; digest without `web_html` → 404.
- Config: schema accepts/defaults new key; Content form round-trips it.

## Out of scope

- Issue archive/index page.
- Restyling old issues (snapshot HTML is immutable).
- Backfilling web versions for existing digests.
- Per-library section limits.
