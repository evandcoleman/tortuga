# Newsletter Layout Axis — Design

**Date:** 2026-05-23
**Status:** Approved (design), pending spec review

## Summary

Add a **layout** axis to the newsletter, orthogonal to the existing **theme** axis.
Themes own *tokens* (palette, fonts, style knobs); layouts own *structure* (how items
are arranged). They compose freely: any theme × any layout.

Four layouts ship:

- **List** (baseline, current behavior) — poster left, text right card.
- **Gallery** — poster grid, 3 per row, minimal text. Image-forward.
- **Compact** — text-only, no posters. Tight scannable list.
- **Magazine** — single column, large hero poster per item with overview below.

## Motivation

Themes were cheap because every theme renders the *same* JSX tree and only swaps
tokens. Layout is a genuinely different axis — different structure — so it must be
modeled separately rather than folded into `Theme`. Modeling it as its own registry
keeps it as cheap to extend as themes are.

## Architecture

### Layout registry (new: `src/modules/newsletter/templates/layouts/`)

Mirror the theme registry pattern (`themes.ts`) exactly.

```ts
// layouts/index.ts
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';

export interface NewsletterLayout {
  id: string;            // 'list' | 'gallery' | 'compact' | 'magazine'
  label: string;
  Items: (props: { items: EnrichedItem[]; theme: Theme }) => React.ReactNode;
}

export const DEFAULT_LAYOUT_ID = 'list';
export const LAYOUTS: Record<string, NewsletterLayout>;   // registry
export function resolveLayout(id?: string | null): NewsletterLayout; // falls back to default
export const LAYOUT_OPTIONS: { value: string; label: string }[];     // for settings dropdown
```

One file per layout component:

- `layouts/list.tsx` — the current `ItemCard`, moved out of `digest.tsx`.
- `layouts/gallery.tsx`
- `layouts/compact.tsx`
- `layouts/magazine.tsx`

Each `Items` component receives the items for a single library section plus the
resolved `theme`, and renders only those items. It consumes `theme` tokens
(`palette`, `fonts`, `layout`) so all 4×4 combos stay visually coherent.

### Shared chrome stays in `DigestEmail`

`DigestEmail` keeps everything that is NOT per-item-structure:

- Header (eyebrow, H1, date range)
- Intro + AI disclaimer
- The per-library **section header** (`LIBRARY · N titles` + hairline rule)
- CTA links (request / personal)
- Footer (unsubscribe)

It resolves the layout once (`resolveLayout(layoutId)`) and, inside each library
section, renders the section header then `<layout.Items items={group} theme={theme} />`.
A layout never re-implements chrome; it only decides how a group of items is laid out.

### Email-client safety

Email HTML must be table-based; CSS grid/flex is unreliable in Outlook and parts of
Gmail.

- **Gallery:** chunk each section's items into rows of 3, render with react-email
  `<Row>`/`<Column>`. No CSS grid.
- **Magazine:** full-width `<Img>` stack inside `<Section>`/`<Row>`.
- **Compact:** text rows, no images.
- **List:** unchanged (already table-based).

## Config + pipeline

- `src/kernel/config/schema.ts`: add `layout: z.string().default('list')` next to the
  existing `theme` field.
- `src/modules/newsletter/pipeline/run.ts`: pass `layoutId: opts.config.layout` into
  `DigestEmail`. New optional `layoutId?` prop on `DigestEmailProps`, resolved with
  fallback exactly like `themeId`.

Unknown/blank layout ids resolve to the default, so config never hard-fails (same
guarantee as themes).

## Preview UI

`src/app/(admin)/newsletter/preview/`:

- `page.tsx`: pre-render the full matrix server-side — every theme × layout combo
  (4 × 4 = 16 HTML strings).
- Rename/extend `ThemeSwitcher.tsx` → `PreviewSwitcher.tsx` with **two button rows**:
  - Row 1: Theme (Editorial / Swiss / Dark Luxury / Newsprint)
  - Row 2: Layout (List / Gallery / Compact / Magazine)
- Selecting either axis swaps the iframe `srcDoc` to the matching combo. Initial
  selection maps to the saved `theme` + `layout` config.

## Testing

- New `layouts.test.tsx`:
  - Each layout's `Items` renders without throwing for representative items.
  - Structural markers: gallery produces multiple poster columns per row; compact
    produces no `<img>`; magazine produces a full-width poster; list matches current
    card markup.
  - `resolveLayout` returns default for unknown/blank id.
- Extend `digest.test.ts`: assert `DigestEmail` delegates item rendering to the
  selected layout (e.g. compact produces no poster `<img>` in the body).
- Extend `scripts/render-themes.mts`: dump the full theme × layout matrix to HTML for
  manual eyeballing.

## Scope guards (YAGNI)

- Section header stays shared chrome, not per-layout — minimizes branching.
- No new theme knobs introduced for layouts.
- No per-layout config beyond the layout id.
- No new layouts beyond the four agreed.

## Files touched

**New**
- `templates/layouts/index.ts`
- `templates/layouts/list.tsx`
- `templates/layouts/gallery.tsx`
- `templates/layouts/compact.tsx`
- `templates/layouts/magazine.tsx`
- `templates/layouts.test.tsx` (or co-located under `layouts/`)

**Modified**
- `templates/digest.tsx` (remove `ItemCard`, add layout delegation + `layoutId` prop)
- `templates/digest.test.ts`
- `kernel/config/schema.ts`
- `modules/newsletter/pipeline/run.ts`
- `app/(admin)/newsletter/preview/page.tsx`
- `app/(admin)/newsletter/preview/ThemeSwitcher.tsx` → `PreviewSwitcher.tsx`
- `scripts/render-themes.mts`
- `app/(admin)/settings/SettingsForm.tsx` — add a "Layout" `SelectField`
  (`LAYOUT_OPTIONS`) in the existing "Appearance" card, alongside the Theme field.
- `app/(admin)/settings/form-parse.ts` — parse `layout` (`str(fd, 'layout') || 'list'`).
- `app/(admin)/settings/form-parse.test.ts` — cover the new `layout` field.
