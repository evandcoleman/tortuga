# Newsletter Appearance Customization — Design

**Date:** 2026-05-29
**Status:** Approved (design), pending spec review
**Scope:** Deep customization of the existing "new this week, grouped by library" digest. No new content types or data pipelines.

## Problem

The newsletter's appearance is controlled by exactly two config fields — `theme` (one of 4 code presets) and `layout` (one of 4 code presets) — selected via two `<select>`s on the Settings page. Everything else (block order, per-item fields, library section titles/caps, header/footer text, all colors/fonts beyond the 4 themes) is hardcoded in `digest.tsx` and the layout components. Users want fine-grained control without code changes.

## Non-Goals (explicitly out of scope)

- **Watch-stats sections** (Most Watched / Top Users / Stats). These require a new Tautulli watch-data pipeline and new render sections — a separate, larger project.
- **Save-custom-presets-to-DB.** Presets are built-in only; users persist their own via JSON export/import.
- Unrelated refactors of the render pipeline beyond what threading the new options requires.

## The Real Newsletter Anatomy (verified against `digest.tsx`)

Render order today:

1. **Header** — `"{app} · Weekly"` eyebrow → `"New on {app}"` h1 → date range + item count
2. **AI intro** — optional, only when `commentary.enabled`
3. **Divider**
4. **Per-library sections** — items grouped by Plex `libraryName`; each section: library name + count → hairline → items rendered via the chosen layout
5. **Freeform HTML** — optional (`extras.freeform_markdown`)
6. **Action buttons** — optional (`extras.request_url` / `personal_url`)
7. **Footer** — app label + unsubscribe

There is one content type: new additions in the lookback window, grouped by library.

## Design Principle

**Every new field is optional with a default that reproduces today's output byte-for-byte.** Config override is persisted as a serialized blob (`writeConfigOverride(db, fullNewsletterConfig)` + `invalidateAppContext()`), so adding optional schema fields is non-breaking and requires **no Drizzle migration**. The live production config keeps rendering identically until a user opts into customization.

---

## A. Config schema extensions (`src/kernel/config/schema.ts`)

New optional `appearance` object on `NewsletterConfigSchema`:

```
appearance: z.object({
  theme_overrides: ThemeOverridesSchema.optional(),   // partial palette/fonts/layout knobs
  blocks: z.array(BlockSchema).optional(),             // ordered block descriptors
  libraries: z.array(LibraryRuleSchema).optional(),    // per-library order/visibility/rename/cap/layout
  item_display: ItemDisplaySchema.optional(),
  header: HeaderSchema.optional(),
  footer: FooterSchema.optional(),
}).optional()
```

### `ThemeOverridesSchema`
Deep-partial of the existing `ThemePalette`, `Theme.fonts`, and `ThemeLayout` shapes. Every field optional; deep-merged onto the resolved base theme. Color/font/number fields run through the validators in section C.

### `BlockSchema`
```
{ id: z.enum(['header','intro','libraries','freeform','actions','footer']), enabled: z.boolean() }
```
`blocks` is the ordered list driving render order + visibility. **Default** (when `blocks` absent): the current order, all enabled. Validation: each id appears at most once; unknown ids rejected; missing ids treated as enabled in default position (so the array can be partial-tolerant, but the editor always writes the full set).

### `LibraryRuleSchema`
```
{ name: z.string().min(1),
  enabled: z.boolean().default(true),
  title: z.string().max(120).optional(),     // rename section heading
  max_items: z.number().int().positive().max(100).optional(),  // override filters.max_items_per_section
  layout: z.string().optional() }            // per-library layout id override (must resolve via LAYOUTS)
```
Libraries present in the array render in array order with their overrides. Libraries **not** listed keep defaults and render after listed ones in current (input) order. Disabled libraries are omitted.

### `ItemDisplaySchema`
```
{ show_poster: z.boolean().default(true),
  show_rating: z.boolean().default(true),
  show_overview: z.boolean().default(true),
  overview_max_chars: z.number().int().min(0).max(1000).optional(),
  poster_scale: z.enum(['sm','md','lg']).default('md') }
```
`poster_scale` multiplies each layout's base poster dimensions (sm ≈ 0.75×, md = 1×, lg ≈ 1.3×). `overview_max_chars` is **optional with no default**: when `undefined`, each layout keeps its current truncation (list 220, magazine 360), preserving byte-for-byte parity; a set value overrides it uniformly.

### `HeaderSchema`
```
{ eyebrow: z.string().max(120).optional(),   // default "{app} · Weekly"
  title: z.string().max(160).optional(),     // default "New on {app}"
  show_count: z.boolean().default(true),
  show_date_range: z.boolean().default(true) }
```

### `FooterSchema`
```
{ text: z.string().max(500).optional(),      // extra footer line; unsubscribe always retained
  show_app_label: z.boolean().default(true) }
```
Unsubscribe link is **never** removable (compliance).

---

## B. Render threading

### `themes.ts`
- Add `resolveThemeWithOverrides(baseId, overrides?): Theme` — resolves the base theme, then deep-merges `theme_overrides`. Pure, fully unit-tested. Existing `resolveTheme` stays as the no-override path.

### `digest.tsx`
- Replace the hardcoded section order with iteration over the resolved `blocks` list (default order when absent). Each block id maps to a render function: `renderHeader`, `renderIntro`, `renderLibraries`, `renderFreeform`, `renderActions`, `renderFooter`.
- `renderHeader` reads `appearance.header` (eyebrow/title overrides, show_count, show_date_range).
- `renderFooter` reads `appearance.footer`.
- `renderLibraries` applies `LibraryRule` ordering/visibility/title/max_items/layout and passes `item_display` down.
- Skip blocks that are disabled **or** have no content (e.g. intro when commentary off, freeform when empty) — preserving current conditional behavior.

### `layouts/*` (`list`, `gallery`, `compact`, `magazine`)
- `LayoutItemsProps` gains `itemDisplay: ItemDisplay`. Each layout honors `show_poster` / `show_rating` / `show_overview` / `overview_max_chars` / `poster_scale`. Poster dimensions become `base * scaleFactor(poster_scale)` instead of hardcoded literals.

---

## C. Security — CSS injection prevention

Override values are inlined into email `style` attributes, so untrusted strings are dangerous.

- **Colors:** must match a strict pattern — `#rgb`/`#rrggbb`/`#rrggbbaa`, `rgb()/rgba()`, `hsl()/hsla()`, or a fixed allowlist of CSS named colors. Reject anything containing `;`, `}`, `{`, `url(`, `expression`, `/*`, or newlines.
- **Font stacks:** allowed charset `[A-Za-z0-9 ,"'\-]` only; bounded length; no `;{}()`.
- **Numerics** (radius, weight, widths, letter-spacing as number): Zod `.min/.max` bounds.
- **Letter-spacing strings** (e.g. `-0.02em`): strict `^-?\d+(\.\d+)?(em|px|rem)$` pattern.

These validators live in a dedicated, unit-tested module (`appearance/sanitize.ts`) and are applied both at schema-parse time (`.refine`) and again at the import boundary (section D). Failing values are rejected with a clear error, never silently stripped.

The existing `freeform_markdown` → `dangerouslySetInnerHTML` path is unchanged (pre-existing behavior, admin-authored).

---

## D. Presets + Export/Import

### Built-in presets (`appearance/presets.ts`)
~4 named bundles, each a complete `appearance` value (+ base `theme`/`layout`):
- **Editorial Classic** — equals today's default output (the "reset" baseline).
- **Minimalist** — compact layout, no overview, small posters, tight palette.
- **Gallery Wall** — gallery layout, posters emphasized, ratings off.
- **Dark Luxury** — dark-luxury theme with refined overrides.

Applying a preset populates the working appearance config; the user can then tweak any field.

### Export / Import
- **Export:** serialize the `appearance` subset (+ `theme`/`layout` ids) to a downloadable JSON file.
- **Import:** upload JSON → parse with the full Zod `appearance` schema **and** the section-C sanitizers → on success, load into the working config; on failure, show field-level errors. No partial application.

---

## E. UI — new page `/(admin)/newsletter/customize`

The two-select "Appearance" card in Settings is too small. New dedicated page (Settings card gets a "Customize appearance →" link). Sections:

- **Base** — theme + layout selects (existing components).
- **Block editor** — `dnd-kit` draggable rows, each with a visibility toggle. Keyboard-accessible (dnd-kit sortable keyboard sensor). Writes the full ordered `blocks` array.
- **Library editor** — one row per known library: rename, item cap, per-library layout, hide, reorder. Known libraries populated from the last preview/sync cache; free-text "add library by name" supported for libraries not yet seen.
- **Theme overrides** — grouped, collapsible controls: color swatches (with text input honoring the section-C pattern), font-stack inputs, radius/weight/width sliders or number inputs.
- **Item display** — toggles for poster/rating/overview, `overview_max_chars` input, poster-size segmented control.
- **Header / footer** — text inputs + the show/hide toggles.
- **Presets** — apply-preset buttons + Export / Import buttons.
- **Live preview** — an `<iframe>` rendering the **full** working config (all customization applied), debounced, via a new `renderPreview(candidateConfig)` server action that reuses the existing render path. The existing 16-combo theme×layout matrix is kept as a quick base-explorer.

Persistence reuses the existing `writeConfigOverride` + `invalidateAppContext` flow. Server actions validate input with the same Zod schema before persisting.

### New dependency
`dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`) — admin-page only, not shipped in the email HTML.

---

## F. Testing (AAA, ≥80%)

**Unit**
- Schema: absent `appearance` ⇒ defaults reproduce current `NewsletterConfig` behavior; partial blocks tolerated; duplicate/unknown block ids rejected.
- `resolveThemeWithOverrides` deep-merge correctness (override wins, untouched fields preserved).
- Section-C sanitizers: accept valid colors/fonts/units; reject every injection vector (`;`, `}`, `url(`, `expression`, newlines, oversized).
- Preset application produces a valid `appearance`; **Editorial Classic** ⇒ output identical to no-appearance default.
- Import round-trip: export → import yields equivalent config; malformed/malicious JSON rejected with errors.
- Per-library rule resolution: ordering, hide, rename, cap, layout override; unlisted libraries fall through.

**Component / snapshot (`digest.tsx`)**
- Block reorder changes section order; disabled blocks omitted; unsubscribe always present.
- `item_display` toggles hide poster/rating/overview; `poster_scale` changes dimensions.
- Header/footer overrides applied.

**Existing suites** (`digest.test.ts`, `themes.test.ts`, `layouts/index.test.ts`, `item-format.test.ts`) must stay green unchanged — the parity guarantee.

---

## Risks & Mitigations

- **Render parity regressions** → "Editorial Classic == default" snapshot test + keep all existing snapshots unchanged.
- **CSS injection via overrides** → section-C sanitizers at both parse and import boundaries.
- **Email-client CSS support** → overrides only widen existing inline-style values already proven across the 4 themes; no new CSS features introduced.
- **Config blob growth** → bounded string/array lengths in schema.

## Rollout

No migration. Ship behind nothing (additive + backward-compatible). Verify on Olympus via the standard deploy contract; confirm `/api/healthz` and a test-send after deploy.
