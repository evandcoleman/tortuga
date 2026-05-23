# Newsletter Layout Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `layout` axis (List / Gallery / Compact / Magazine) to the newsletter, orthogonal to the existing `theme` axis, selectable in settings and previewable as a full theme×layout matrix.

**Architecture:** A layout registry mirrors the existing theme registry (`themes.ts`). `DigestEmail` keeps all shared chrome (header, intro, per-library section header, CTA, footer) and delegates only the per-section item rendering to the resolved layout's `Items` component. Each layout is a small focused component consuming `theme` tokens, so every theme×layout combo stays coherent. All layouts use table-based react-email primitives (no CSS grid) for email-client safety.

**Tech Stack:** TypeScript, React, `@react-email/components`, `@react-email/render`, Zod (config schema), Vitest, Next.js (admin preview/settings pages).

---

## File Structure

**New**
- `src/modules/newsletter/templates/item-format.ts` — shared item formatting helpers (`itemKicker`, `truncate`, `displayTitle`), extracted from `digest.tsx`.
- `src/modules/newsletter/templates/layouts/index.ts` — layout registry (`NewsletterLayout`, `LAYOUTS`, `DEFAULT_LAYOUT_ID`, `resolveLayout`, `LAYOUT_OPTIONS`).
- `src/modules/newsletter/templates/layouts/list.tsx` — `ListItems` (current `ItemCard`, moved).
- `src/modules/newsletter/templates/layouts/gallery.tsx` — `GalleryItems` (poster grid, 3/row).
- `src/modules/newsletter/templates/layouts/compact.tsx` — `CompactItems` (text-only rows).
- `src/modules/newsletter/templates/layouts/magazine.tsx` — `MagazineItems` (hero stack).
- `src/modules/newsletter/templates/layouts/index.test.ts` — registry unit tests.
- `scripts/render-matrix.mts` — dumps every theme×layout combo to HTML files for eyeballing.

**Modified**
- `src/modules/newsletter/templates/digest.tsx` — remove `ItemCard`/`itemKicker`/`truncate`; add `layoutId` prop + layout delegation.
- `src/modules/newsletter/templates/digest.test.ts` — per-layout structural assertions.
- `src/kernel/config/schema.ts` — add `layout` field.
- `src/modules/newsletter/pipeline/preview-cache.ts` — matrix preview entry type.
- `src/modules/newsletter/pipeline/run.ts` — pass `layoutId`; render theme×layout matrix.
- `src/app/(admin)/newsletter/preview/ThemeSwitcher.tsx` → `PreviewSwitcher.tsx` — two-axis switcher.
- `src/app/(admin)/newsletter/preview/page.tsx` — use `PreviewSwitcher`, pass default layout.
- `src/app/(admin)/settings/SettingsForm.tsx` — add Layout `SelectField`.
- `src/app/(admin)/settings/form-parse.ts` — parse `layout`.
- `src/app/(admin)/settings/form-parse.test.ts` — cover `layout`.

---

## Task 1: Extract shared item-format helpers

**Files:**
- Create: `src/modules/newsletter/templates/item-format.ts`
- Modify: `src/modules/newsletter/templates/digest.tsx` (remove the moved helpers — done in Task 6)

- [ ] **Step 1: Create the helpers file**

```ts
// src/modules/newsletter/templates/item-format.ts
import type { EnrichedItem } from '../types';

export function itemKicker(item: EnrichedItem): string | null {
  const bits: string[] = [];
  if (item.mediaType === 'movie') bits.push('Film');
  if (item.mediaType === 'show') bits.push('Series');
  if (item.mediaType === 'season' && typeof item.seasonNumber === 'number') {
    bits.push(`Season ${item.seasonNumber}`);
  }
  if (item.episodeCount) {
    bits.push(`${item.episodeCount} new episode${item.episodeCount === 1 ? '' : 's'}`);
  }
  if (item.year) bits.push(String(item.year));
  return bits.length > 0 ? bits.join(' · ') : null;
}

export function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function displayTitle(item: EnrichedItem): string {
  return item.mediaType === 'season' && item.showTitle ? item.showTitle : item.title;
}
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit`
Expected: PASS (no errors introduced; helpers not yet imported elsewhere).

- [ ] **Step 3: Commit**

```bash
git add src/modules/newsletter/templates/item-format.ts
git commit -m "refactor(newsletter): extract shared item-format helpers"
```

---

## Task 2: List layout + registry skeleton

**Files:**
- Create: `src/modules/newsletter/templates/layouts/list.tsx`
- Create: `src/modules/newsletter/templates/layouts/index.ts`
- Create: `src/modules/newsletter/templates/layouts/index.test.ts`

- [ ] **Step 1: Write the failing registry test**

```ts
// src/modules/newsletter/templates/layouts/index.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLayout, DEFAULT_LAYOUT_ID, LAYOUT_OPTIONS, LAYOUTS } from './index';

describe('layout registry', () => {
  it('resolves a known id', () => {
    expect(resolveLayout('list').id).toBe('list');
  });

  it('falls back to default for unknown or blank id', () => {
    expect(resolveLayout('nope').id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout('').id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout(undefined).id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout(null).id).toBe(DEFAULT_LAYOUT_ID);
  });

  it('exposes options for every registered layout', () => {
    expect(LAYOUT_OPTIONS).toEqual(
      Object.values(LAYOUTS).map(l => ({ value: l.id, label: l.label })),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/newsletter/templates/layouts/index.test.ts`
Expected: FAIL — cannot resolve module `./index`.

- [ ] **Step 3: Create the List layout (move `ItemCard` out of digest.tsx)**

```tsx
// src/modules/newsletter/templates/layouts/list.tsx
import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import { itemKicker, truncate, displayTitle } from '../item-format';

export function ListItems({ items, theme }: { items: EnrichedItem[]; theme: Theme }) {
  return (
    <>
      {items.map(item => (
        <ItemCard key={item.guid} item={item} theme={theme} />
      ))}
    </>
  );
}

function ItemCard({ item, theme }: { item: EnrichedItem; theme: Theme }) {
  const { palette, fonts, layout } = theme;
  const kicker = itemKicker(item);
  const overview = truncate(item.overview, 220);
  const showsRating = item.rating > 0;
  const title = displayTitle(item);
  const posterRadius = Math.min(4, layout.radius);

  return (
    <Section
      style={{
        marginTop: 20,
        background: palette.cardBg,
        border: `${layout.cardBorderWidth}px solid ${palette.hairline}`,
        borderRadius: layout.radius,
        boxShadow: layout.cardShadow,
        padding: 16,
      }}
    >
      <Row>
        <Column style={{ verticalAlign: 'top', paddingRight: 16, width: 104 }}>
          {item.posterUrl ? (
            <Img
              src={item.posterUrl}
              alt=""
              width={88}
              height={132}
              style={{
                display: 'block',
                width: 88,
                height: 132,
                borderRadius: posterRadius,
                border: `1px solid ${palette.hairline}`,
                background: palette.chipBg,
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 132,
                borderRadius: posterRadius,
                background: palette.chipBg,
                border: `1px dashed ${palette.rule}`,
              }}
            />
          )}
        </Column>

        <Column style={{ verticalAlign: 'top' }}>
          {kicker ? (
            <Text
              style={{
                margin: 0,
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: palette.chipFg,
                fontWeight: 600,
              }}
            >
              {kicker}
            </Text>
          ) : null}
          <Heading
            as="h3"
            style={{
              margin: '4px 0 0',
              fontFamily: fonts.heading,
              fontSize: 20,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: palette.ink,
              fontWeight: layout.headingWeight,
            }}
          >
            {title}
          </Heading>

          {showsRating ? (
            <Text style={{ margin: '6px 0 0', fontSize: 12, color: palette.muted }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: layout.radius === 0 ? 0 : 999,
                  background: palette.chipBg,
                  color: palette.chipFg,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                }}
              >
                ★ {item.rating.toFixed(1)}
              </span>
            </Text>
          ) : null}

          {overview ? (
            <Text
              style={{
                margin: '10px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: palette.ink,
              }}
            >
              {overview}
            </Text>
          ) : null}

          {item.plexUrl ? (
            <Text style={{ margin: '12px 0 0', fontSize: 13 }}>
              <Link
                href={item.plexUrl}
                style={{
                  color: palette.accent,
                  textDecoration: 'none',
                  fontWeight: 600,
                  letterSpacing: 0.2,
                }}
              >
                Open in Plex →
              </Link>
            </Text>
          ) : null}
        </Column>
      </Row>
    </Section>
  );
}
```

- [ ] **Step 4: Create the registry with only List registered**

```ts
// src/modules/newsletter/templates/layouts/index.ts
import type { ReactNode } from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import { ListItems } from './list';

export interface NewsletterLayout {
  id: string;
  label: string;
  Items: (props: { items: EnrichedItem[]; theme: Theme }) => ReactNode;
}

export const listLayout: NewsletterLayout = { id: 'list', label: 'List', Items: ListItems };

export const DEFAULT_LAYOUT_ID = 'list';

export const LAYOUTS: Record<string, NewsletterLayout> = {
  [listLayout.id]: listLayout,
};

export function resolveLayout(id?: string | null): NewsletterLayout {
  return (id ? LAYOUTS[id] : undefined) ?? LAYOUTS[DEFAULT_LAYOUT_ID];
}

export const LAYOUT_OPTIONS = Object.values(LAYOUTS).map(l => ({ value: l.id, label: l.label }));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/modules/newsletter/templates/layouts/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/newsletter/templates/layouts/list.tsx src/modules/newsletter/templates/layouts/index.ts src/modules/newsletter/templates/layouts/index.test.ts
git commit -m "feat(newsletter): add layout registry with List layout"
```

---

## Task 3: Gallery layout

**Files:**
- Create: `src/modules/newsletter/templates/layouts/gallery.tsx`
- Modify: `src/modules/newsletter/templates/layouts/index.ts`

- [ ] **Step 1: Create the Gallery layout**

```tsx
// src/modules/newsletter/templates/layouts/gallery.tsx
import { Column, Link, Row, Section, Text, Img } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import { displayTitle } from '../item-format';

const PER_ROW = 3;
const POSTER_W = 150;
const POSTER_H = 225;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function GalleryItems({ items, theme }: { items: EnrichedItem[]; theme: Theme }) {
  const { palette, fonts, layout } = theme;
  const posterRadius = Math.min(4, layout.radius);
  const rows = chunk(items, PER_ROW);
  const colStyle = { verticalAlign: 'top' as const, width: `${100 / PER_ROW}%`, padding: 8 };

  return (
    <Section style={{ marginTop: 12 }}>
      {rows.map((row, ri) => (
        <Row key={ri}>
          {row.map(item => (
            <Column key={item.guid} style={colStyle}>
              {item.posterUrl ? (
                <Img
                  src={item.posterUrl}
                  alt=""
                  width={POSTER_W}
                  height={POSTER_H}
                  style={{
                    display: 'block',
                    width: POSTER_W,
                    height: POSTER_H,
                    borderRadius: posterRadius,
                    border: `1px solid ${palette.hairline}`,
                    background: palette.chipBg,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: POSTER_W,
                    height: POSTER_H,
                    borderRadius: posterRadius,
                    background: palette.chipBg,
                    border: `1px dashed ${palette.rule}`,
                  }}
                />
              )}
              <Text
                style={{
                  margin: '8px 0 0',
                  fontFamily: fonts.heading,
                  fontSize: 13,
                  lineHeight: 1.25,
                  fontWeight: layout.headingWeight,
                  color: palette.ink,
                }}
              >
                {item.plexUrl ? (
                  <Link href={item.plexUrl} style={{ color: palette.ink, textDecoration: 'none' }}>
                    {displayTitle(item)}
                  </Link>
                ) : (
                  displayTitle(item)
                )}
              </Text>
            </Column>
          ))}
          {row.length < PER_ROW
            ? Array.from({ length: PER_ROW - row.length }).map((_, i) => (
                <Column key={`pad-${i}`} style={colStyle} />
              ))
            : null}
        </Row>
      ))}
    </Section>
  );
}
```

- [ ] **Step 2: Register Gallery in the registry**

In `src/modules/newsletter/templates/layouts/index.ts`, add the import and registration. The import block becomes:

```ts
import { ListItems } from './list';
import { GalleryItems } from './gallery';
```

Add after `listLayout`:

```ts
export const galleryLayout: NewsletterLayout = { id: 'gallery', label: 'Gallery', Items: GalleryItems };
```

And extend the `LAYOUTS` map:

```ts
export const LAYOUTS: Record<string, NewsletterLayout> = {
  [listLayout.id]: listLayout,
  [galleryLayout.id]: galleryLayout,
};
```

- [ ] **Step 3: Run registry tests to confirm still green**

Run: `npx vitest run src/modules/newsletter/templates/layouts/index.test.ts`
Expected: PASS (LAYOUT_OPTIONS now includes gallery; test derives from LAYOUTS so it stays valid).

- [ ] **Step 4: Commit**

```bash
git add src/modules/newsletter/templates/layouts/gallery.tsx src/modules/newsletter/templates/layouts/index.ts
git commit -m "feat(newsletter): add Gallery layout"
```

---

## Task 4: Compact layout

**Files:**
- Create: `src/modules/newsletter/templates/layouts/compact.tsx`
- Modify: `src/modules/newsletter/templates/layouts/index.ts`

- [ ] **Step 1: Create the Compact layout**

```tsx
// src/modules/newsletter/templates/layouts/compact.tsx
import { Column, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import { itemKicker, displayTitle } from '../item-format';

export function CompactItems({ items, theme }: { items: EnrichedItem[]; theme: Theme }) {
  const { palette, fonts, layout } = theme;
  return (
    <Section style={{ marginTop: 8 }}>
      {items.map(item => {
        const kicker = itemKicker(item);
        return (
          <Row key={item.guid} style={{ borderBottom: `1px solid ${palette.hairline}` }}>
            <Column style={{ verticalAlign: 'baseline', padding: '8px 0' }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontFamily: fonts.heading,
                  fontWeight: layout.headingWeight,
                  color: palette.ink,
                  lineHeight: 1.3,
                }}
              >
                {item.plexUrl ? (
                  <Link href={item.plexUrl} style={{ color: palette.ink, textDecoration: 'none' }}>
                    {displayTitle(item)}
                  </Link>
                ) : (
                  displayTitle(item)
                )}
                {kicker ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: palette.muted,
                      fontFamily: fonts.body,
                    }}
                  >
                    {'  ·  '}
                    {kicker}
                  </span>
                ) : null}
              </Text>
            </Column>
            {item.rating > 0 ? (
              <Column align="right" style={{ verticalAlign: 'baseline', padding: '8px 0' }}>
                <Text style={{ margin: 0, fontSize: 12, color: palette.chipFg }}>
                  ★ {item.rating.toFixed(1)}
                </Text>
              </Column>
            ) : null}
          </Row>
        );
      })}
    </Section>
  );
}
```

- [ ] **Step 2: Register Compact in the registry**

In `src/modules/newsletter/templates/layouts/index.ts`, add import `import { CompactItems } from './compact';`, add:

```ts
export const compactLayout: NewsletterLayout = { id: 'compact', label: 'Compact', Items: CompactItems };
```

and add `[compactLayout.id]: compactLayout,` to the `LAYOUTS` map.

- [ ] **Step 3: Run registry tests**

Run: `npx vitest run src/modules/newsletter/templates/layouts/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/newsletter/templates/layouts/compact.tsx src/modules/newsletter/templates/layouts/index.ts
git commit -m "feat(newsletter): add Compact layout"
```

---

## Task 5: Magazine layout

**Files:**
- Create: `src/modules/newsletter/templates/layouts/magazine.tsx`
- Modify: `src/modules/newsletter/templates/layouts/index.ts`

- [ ] **Step 1: Create the Magazine layout**

`POSTER_W` is 584 = 640 container − 2×28 horizontal padding.

```tsx
// src/modules/newsletter/templates/layouts/magazine.tsx
import { Heading, Img, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import { itemKicker, truncate, displayTitle } from '../item-format';

const POSTER_W = 584;
const POSTER_H = 328;

export function MagazineItems({ items, theme }: { items: EnrichedItem[]; theme: Theme }) {
  const { palette, fonts, layout } = theme;
  return (
    <>
      {items.map(item => {
        const kicker = itemKicker(item);
        const overview = truncate(item.overview, 360);
        return (
          <Section key={item.guid} style={{ marginTop: 24 }}>
            {item.posterUrl ? (
              <Img
                src={item.posterUrl}
                alt=""
                width={POSTER_W}
                height={POSTER_H}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  borderRadius: Math.min(8, layout.radius),
                  border: `1px solid ${palette.hairline}`,
                }}
              />
            ) : null}
            {kicker ? (
              <Text
                style={{
                  margin: '14px 0 0',
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: palette.chipFg,
                  fontWeight: 600,
                }}
              >
                {kicker}
              </Text>
            ) : null}
            <Heading
              as="h3"
              style={{
                margin: '4px 0 0',
                fontFamily: fonts.heading,
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: layout.headingLetterSpacing,
                color: palette.ink,
                fontWeight: layout.headingWeight,
              }}
            >
              {displayTitle(item)}
            </Heading>
            {item.rating > 0 ? (
              <Text style={{ margin: '6px 0 0', fontSize: 12, color: palette.muted }}>
                ★ {item.rating.toFixed(1)}
              </Text>
            ) : null}
            {overview ? (
              <Text style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: palette.ink }}>
                {overview}
              </Text>
            ) : null}
            {item.plexUrl ? (
              <Text style={{ margin: '12px 0 0', fontSize: 13 }}>
                <Link
                  href={item.plexUrl}
                  style={{ color: palette.accent, textDecoration: 'none', fontWeight: 600 }}
                >
                  Open in Plex →
                </Link>
              </Text>
            ) : null}
          </Section>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Register Magazine in the registry**

In `src/modules/newsletter/templates/layouts/index.ts`, add import `import { MagazineItems } from './magazine';`, add:

```ts
export const magazineLayout: NewsletterLayout = { id: 'magazine', label: 'Magazine', Items: MagazineItems };
```

and add `[magazineLayout.id]: magazineLayout,` to the `LAYOUTS` map. Final map order: list, gallery, compact, magazine.

- [ ] **Step 3: Run registry tests**

Run: `npx vitest run src/modules/newsletter/templates/layouts/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/newsletter/templates/layouts/magazine.tsx src/modules/newsletter/templates/layouts/index.ts
git commit -m "feat(newsletter): add Magazine layout"
```

---

## Task 6: Wire layout axis into DigestEmail

**Files:**
- Modify: `src/modules/newsletter/templates/digest.tsx`
- Modify: `src/modules/newsletter/templates/digest.test.ts`

- [ ] **Step 1: Add failing per-layout tests**

Append these tests to `src/modules/newsletter/templates/digest.test.ts`, inside the existing `describe('DigestEmail', ...)` block (after the last `it`). They assert per-layout poster markers: List poster `width="88"`, Gallery poster `width="150"`, Magazine poster `width="584"`, Compact has no poster from `image.tmdb.org`.

```ts
  it('defaults to the List layout (88px poster)', async () => {
    const html = await render(DigestEmail(baseProps));
    expect(html).toContain('width="88"');
  });

  it('renders the Gallery layout (150px posters, no 88px card poster)', async () => {
    const html = await render(DigestEmail({ ...baseProps, layoutId: 'gallery' }));
    expect(html).toContain('width="150"');
    expect(html).not.toContain('width="88"');
  });

  it('renders the Magazine layout (full-width 584px poster)', async () => {
    const html = await render(DigestEmail({ ...baseProps, layoutId: 'magazine' }));
    expect(html).toContain('width="584"');
  });

  it('renders the Compact layout with no posters', async () => {
    const html = await render(DigestEmail({ ...baseProps, layoutId: 'compact' }));
    expect(html).not.toContain('image.tmdb.org');
    expect(html).toContain('A Movie');
  });

  it('falls back to List for an unknown layout id', async () => {
    const html = await render(DigestEmail({ ...baseProps, layoutId: 'bogus' }));
    expect(html).toContain('width="88"');
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/modules/newsletter/templates/digest.test.ts`
Expected: FAIL — `layoutId` is not a known prop and Gallery/Magazine/Compact markers are absent (only List currently renders).

- [ ] **Step 3: Update `digest.tsx` — imports**

At the top of `digest.tsx`, the component imports currently include `Img`, `Heading`, `Link`, etc. Replace the existing import of `resolveTheme`/types and add the layout import. Locate:

```tsx
import { resolveTheme, type Theme } from './themes';
```

Add immediately below it:

```tsx
import { resolveLayout } from './layouts';
```

- [ ] **Step 4: Add `layoutId` to props**

In `DigestEmailProps`, add the field next to `themeId`:

```tsx
  themeId?: string;
  layoutId?: string;
```

In the `DigestEmail({ ... })` destructure, add `layoutId,` next to `themeId,`.

- [ ] **Step 5: Resolve the layout and delegate item rendering**

After `const theme = resolveTheme(themeId);` add:

```tsx
  const activeLayout = resolveLayout(layoutId);
```

Find the per-section items render inside the `sections` map:

```tsx
              {group.map(item => (
                <ItemCard key={item.guid} item={item} theme={theme} />
              ))}
```

Replace it with:

```tsx
              <activeLayout.Items items={group} theme={theme} />
```

- [ ] **Step 6: Remove the now-moved helpers and `ItemCard` from `digest.tsx`**

Delete the local `function itemKicker(...)`, `function truncate(...)`, and the entire `function ItemCard(...)` definition from `digest.tsx` (they now live in `item-format.ts` and `layouts/list.tsx`). Then remove any imports from `@react-email/components` that are no longer referenced by the remaining `digest.tsx` code (verify with the typecheck in Step 7 — `Img` and any others used only by `ItemCard` should be dropped from the import list).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. If it reports unused imports, remove them from the `@react-email/components` import in `digest.tsx`.

- [ ] **Step 8: Run the digest tests**

Run: `npx vitest run src/modules/newsletter/templates/digest.test.ts`
Expected: PASS (original tests + 5 new layout tests).

- [ ] **Step 9: Commit**

```bash
git add src/modules/newsletter/templates/digest.tsx src/modules/newsletter/templates/digest.test.ts
git commit -m "feat(newsletter): delegate item rendering to selectable layout"
```

---

## Task 7: Add `layout` to config schema + form parsing

**Files:**
- Modify: `src/kernel/config/schema.ts:61`
- Modify: `src/app/(admin)/settings/form-parse.ts:71`
- Modify: `src/app/(admin)/settings/form-parse.test.ts`

- [ ] **Step 1: Write the failing form-parse test**

Append inside `describe('parseNewsletterForm', ...)` in `form-parse.test.ts`:

```ts
  it('parses the layout field, defaulting to list when absent', () => {
    const withLayout = parseNewsletterForm(fd({ ...base, layout: 'gallery' }));
    expect(withLayout.ok).toBe(true);
    if (withLayout.ok) expect(withLayout.config.layout).toBe('gallery');

    const without = parseNewsletterForm(fd(base));
    expect(without.ok).toBe(true);
    if (without.ok) expect(without.config.layout).toBe('list');
  });
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run "src/app/(admin)/settings/form-parse.test.ts"`
Expected: FAIL — `config.layout` is `undefined` (not parsed) / not in schema.

- [ ] **Step 3: Add the schema field**

In `src/kernel/config/schema.ts`, directly below the existing line:

```ts
  theme: z.string().default('editorial'),
```

add:

```ts
  layout: z.string().default('list'),
```

- [ ] **Step 4: Parse the field in form-parse**

In `src/app/(admin)/settings/form-parse.ts`, directly below:

```ts
    theme: str(fd, 'theme') || 'editorial',
```

add:

```ts
    layout: str(fd, 'layout') || 'list',
```

- [ ] **Step 5: Run the form-parse tests**

Run: `npx vitest run "src/app/(admin)/settings/form-parse.test.ts"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/kernel/config/schema.ts "src/app/(admin)/settings/form-parse.ts" "src/app/(admin)/settings/form-parse.test.ts"
git commit -m "feat(newsletter): add layout config field"
```

---

## Task 8: Render the theme×layout matrix in the pipeline

**Files:**
- Modify: `src/modules/newsletter/pipeline/preview-cache.ts`
- Modify: `src/modules/newsletter/pipeline/run.ts`

- [ ] **Step 1: Update the preview-cache entry type**

Replace the `ThemedPreview` interface and `PreviewEntry` in `preview-cache.ts` with a matrix shape:

```ts
// In-memory cache of the latest dry-run preview rendered across every
// theme × layout combination. Transient by design: it lets the preview page
// swap theme/layout instantly without re-fetching data or re-running the AI
// intro. Cleared on process restart — the preview page regenerates on demand.

export interface MatrixPreview {
  themeId: string;
  themeLabel: string;
  layoutId: string;
  layoutLabel: string;
  html: string;
}

interface PreviewEntry {
  digestId: string;
  previews: MatrixPreview[];
}

let latest: PreviewEntry | null = null;

export function setThemedPreviews(entry: PreviewEntry | null): void {
  latest = entry;
}

export function getThemedPreviews(): PreviewEntry | null {
  return latest;
}
```

- [ ] **Step 2: Pass `layoutId` and render the matrix in `run.ts`**

In `src/modules/newsletter/pipeline/run.ts`, add the layouts import below the themes import:

```ts
import { THEMES } from '../templates/themes';
import { LAYOUTS } from '../templates/layouts';
```

In `baseEmailProps`, add `layoutId` next to `themeId`:

```ts
      themeId: opts.config.theme,
      layoutId: opts.config.layout,
```

Replace the existing themed-preview loop:

```ts
    if (opts.cacheThemedPreviews) {
      const previews = [];
      for (const theme of Object.values(THEMES)) {
        const themedHtml = await render(
          createElement(DigestEmail, {
            ...baseEmailProps,
            unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${placeholderUnsub}`,
            themeId: theme.id,
          }),
        );
        previews.push({ id: theme.id, label: theme.label, html: themedHtml });
      }
      setThemedPreviews({ digestId, previews });
    }
```

with the matrix loop:

```ts
    if (opts.cacheThemedPreviews) {
      const previews = [];
      for (const theme of Object.values(THEMES)) {
        for (const lay of Object.values(LAYOUTS)) {
          const comboHtml = await render(
            createElement(DigestEmail, {
              ...baseEmailProps,
              unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${placeholderUnsub}`,
              themeId: theme.id,
              layoutId: lay.id,
            }),
          );
          previews.push({
            themeId: theme.id,
            themeLabel: theme.label,
            layoutId: lay.id,
            layoutLabel: lay.label,
            html: comboHtml,
          });
        }
      }
      setThemedPreviews({ digestId, previews });
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL only in `preview/page.tsx` (it still imports `ThemeSwitcher` and the old preview shape) — that is fixed in Task 9. No other errors. If errors appear elsewhere, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/modules/newsletter/pipeline/preview-cache.ts src/modules/newsletter/pipeline/run.ts
git commit -m "feat(newsletter): render theme x layout preview matrix"
```

---

## Task 9: Two-axis preview switcher

**Files:**
- Create: `src/app/(admin)/newsletter/preview/PreviewSwitcher.tsx`
- Delete: `src/app/(admin)/newsletter/preview/ThemeSwitcher.tsx`
- Modify: `src/app/(admin)/newsletter/preview/page.tsx`

- [ ] **Step 1: Create `PreviewSwitcher.tsx`**

```tsx
// src/app/(admin)/newsletter/preview/PreviewSwitcher.tsx
'use client';

import { useState } from 'react';

export interface MatrixPreview {
  themeId: string;
  themeLabel: string;
  layoutId: string;
  layoutLabel: string;
  html: string;
}

interface Option {
  id: string;
  label: string;
}

function uniqueOptions(previews: MatrixPreview[], kind: 'theme' | 'layout'): Option[] {
  const seen = new Map<string, string>();
  for (const p of previews) {
    const id = kind === 'theme' ? p.themeId : p.layoutId;
    const label = kind === 'theme' ? p.themeLabel : p.layoutLabel;
    if (!seen.has(id)) seen.set(id, label);
  }
  return Array.from(seen, ([id, label]) => ({ id, label }));
}

function AxisRow({
  title,
  options,
  activeId,
  onSelect,
}: {
  title: string;
  options: Option[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
      <span className="mr-1 w-14 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        {title}
      </span>
      {options.map(o => {
        const isActive = o.id === activeId;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            aria-pressed={isActive}
            className={[
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              isActive
                ? 'bg-gold text-gold-ink'
                : 'bg-transparent text-muted hover:bg-surface hover:text-fg',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PreviewSwitcher({
  previews,
  defaultThemeId,
  defaultLayoutId,
}: {
  previews: MatrixPreview[];
  defaultThemeId: string;
  defaultLayoutId: string;
}) {
  const themes = uniqueOptions(previews, 'theme');
  const layouts = uniqueOptions(previews, 'layout');

  const [themeId, setThemeId] = useState(
    themes.find(t => t.id === defaultThemeId)?.id ?? themes[0]?.id ?? '',
  );
  const [layoutId, setLayoutId] = useState(
    layouts.find(l => l.id === defaultLayoutId)?.id ?? layouts[0]?.id ?? '',
  );

  const active =
    previews.find(p => p.themeId === themeId && p.layoutId === layoutId) ?? previews[0];

  return (
    <div>
      <AxisRow title="Theme" options={themes} activeId={themeId} onSelect={setThemeId} />
      <AxisRow title="Layout" options={layouts} activeId={layoutId} onSelect={setLayoutId} />
      <iframe
        srcDoc={active?.html ?? ''}
        title={`Digest preview — ${active?.themeLabel ?? ''} / ${active?.layoutLabel ?? ''}`}
        className="block h-[820px] w-full rounded-b-[10px] bg-white"
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx` imports and data wiring**

In `src/app/(admin)/newsletter/preview/page.tsx`:

Replace the import:

```tsx
import { ThemeSwitcher } from './ThemeSwitcher';
```

with:

```tsx
import { PreviewSwitcher } from './PreviewSwitcher';
```

Replace the default-theme line in the `Preview` component:

```tsx
  const defaultThemeId = ctx.config.newsletter.theme;
```

with:

```tsx
  const defaultThemeId = ctx.config.newsletter.theme;
  const defaultLayoutId = ctx.config.newsletter.layout;
```

Replace the switcher usage:

```tsx
          {themedPreviews ? (
            <ThemeSwitcher previews={themedPreviews} defaultThemeId={defaultThemeId} />
          ) : (
```

with:

```tsx
          {themedPreviews ? (
            <PreviewSwitcher
              previews={themedPreviews}
              defaultThemeId={defaultThemeId}
              defaultLayoutId={defaultLayoutId}
            />
          ) : (
```

(The existing `const themedPreviews = themed && row && themed.digestId === row.id ? themed.previews : null;` line is unchanged — it now carries `MatrixPreview[]`.)

- [ ] **Step 3: Delete the old switcher**

```bash
git rm "src/app/(admin)/newsletter/preview/ThemeSwitcher.tsx"
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no remaining references to `ThemeSwitcher` or the old `ThemedPreview` shape).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/newsletter/preview/PreviewSwitcher.tsx" "src/app/(admin)/newsletter/preview/page.tsx"
git commit -m "feat(newsletter): two-axis theme/layout preview switcher"
```

---

## Task 10: Layout dropdown in settings

**Files:**
- Modify: `src/app/(admin)/settings/SettingsForm.tsx`

- [ ] **Step 1: Import `LAYOUT_OPTIONS`**

In `SettingsForm.tsx`, below the existing import:

```tsx
import { THEME_OPTIONS } from '@/modules/newsletter/templates/themes';
```

add:

```tsx
import { LAYOUT_OPTIONS } from '@/modules/newsletter/templates/layouts';
```

- [ ] **Step 2: Add the Layout field to the Appearance card**

Replace the Appearance card body:

```tsx
        <CardHeader title="Appearance" description="Visual theme for the newsletter email." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="theme" label="Theme" defaultValue={config.theme} options={THEME_OPTIONS} hint="Colors, type, and layout for the email." />
        </div>
```

with:

```tsx
        <CardHeader title="Appearance" description="Visual theme and layout for the newsletter email." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="theme" label="Theme" defaultValue={config.theme} options={THEME_OPTIONS} hint="Colors and typography." />
          <SelectField name="layout" label="Layout" defaultValue={config.layout} options={LAYOUT_OPTIONS} hint="How items are arranged." />
        </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/settings/SettingsForm.tsx"
git commit -m "feat(settings): add newsletter layout selector"
```

---

## Task 11: Matrix render script for eyeballing

**Files:**
- Create: `scripts/render-matrix.mts`

- [ ] **Step 1: Create the script**

Renders one representative digest for every theme × layout combo to `tmp/newsletter-matrix/<theme>__<layout>.html`.

```ts
// scripts/render-matrix.mts
// Usage: npx tsx scripts/render-matrix.mts
// Dumps every theme × layout combination to tmp/newsletter-matrix/*.html
import { mkdir, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { render } from '@react-email/render';
import { DigestEmail } from '../src/modules/newsletter/templates/digest';
import { THEMES } from '../src/modules/newsletter/templates/themes';
import { LAYOUTS } from '../src/modules/newsletter/templates/layouts';
import type { EnrichedItem } from '../src/modules/newsletter/types';

const items: EnrichedItem[] = [
  {
    guid: 'g1', title: 'Dune: Part Two', mediaType: 'movie', libraryName: 'Movies',
    addedAt: new Date('2026-05-01T00:00:00Z'), rating: 8.4, year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    overview: 'Paul Atreides unites with the Fremen to wage war against House Harkonnen.',
    plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=1',
  },
  {
    guid: 'g2', title: 'The Substance', mediaType: 'movie', libraryName: 'Movies',
    addedAt: new Date('2026-05-02T00:00:00Z'), rating: 7.2, year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w500/lqoMzCcZYEFK729d6qzt349fB4o.jpg',
    overview: 'A fading celebrity uses a black-market drug to create a younger version of herself.',
    plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=2',
  },
  {
    guid: 'g3', title: 'Severance', mediaType: 'season', showTitle: 'Severance',
    libraryName: 'TV', addedAt: new Date('2026-05-03T00:00:00Z'), rating: 8.7,
    seasonNumber: 2, episodeCount: 10,
    posterUrl: 'https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg',
    overview: 'Mark and his colleagues uncover the truth behind their severed work lives.',
    plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=3',
  },
];

const baseProps = {
  items,
  unsubscribeUrl: 'https://example.com/u',
  appName: 'Tortuga',
  windowStart: new Date('2026-05-01T00:00:00Z'),
  windowEnd: new Date('2026-05-08T00:00:00Z'),
  intro: 'A strong week of cinema and a long-awaited return to the office.',
};

const outDir = 'tmp/newsletter-matrix';
await mkdir(outDir, { recursive: true });

for (const theme of Object.values(THEMES)) {
  for (const lay of Object.values(LAYOUTS)) {
    const html = await render(
      createElement(DigestEmail, { ...baseProps, themeId: theme.id, layoutId: lay.id }),
    );
    const file = `${outDir}/${theme.id}__${lay.id}.html`;
    await writeFile(file, html, 'utf8');
    console.log(`wrote ${file}`);
  }
}
console.log(`\nDone — ${Object.keys(THEMES).length * Object.keys(LAYOUTS).length} combos in ${outDir}/`);
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/render-matrix.mts`
Expected: 16 lines `wrote tmp/newsletter-matrix/<theme>__<layout>.html`, then a Done summary. (If `tsx` is not installed, install it: `npm i -D tsx`.)

- [ ] **Step 3: Commit (script only — `tmp/` is git-ignored output)**

```bash
git add scripts/render-matrix.mts
git commit -m "chore(newsletter): add theme x layout matrix render script"
```

If `tmp/` is not already git-ignored, do not commit the generated HTML; add `tmp/` to `.gitignore` in this commit instead.

---

## Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, including `layouts/index.test.ts`, `digest.test.ts`, `form-parse.test.ts`.

- [ ] **Step 3: Lint (if the project defines it)**

Run: `npm run lint` (skip if no `lint` script exists in `package.json`).
Expected: PASS.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: PASS — the preview and settings pages compile with the new components.

- [ ] **Step 5: Manual eyeball of the matrix**

Open the files in `tmp/newsletter-matrix/` (e.g. via the gog tool / Google Drive share, since localhost isn't reachable from the operator's machine) and confirm:
- List = poster-left cards (current look).
- Gallery = 3 posters per row with titles beneath.
- Compact = text-only rows, no posters.
- Magazine = full-width hero poster per item with overview.
- All four render correctly under each of the four themes (palette/fonts applied).

- [ ] **Step 6: Live preview-page check (if dev server reachable)**

Start the dev server, open the newsletter preview, click "Generate fresh preview", and confirm the Theme and Layout button rows both switch the iframe live and combine independently. Confirm the Settings → Appearance card shows both Theme and Layout dropdowns and that saving persists `layout`.

- [ ] **Step 7: Final state confirmation**

Run: `git status` and `git log --oneline -12`
Expected: clean working tree; commits for Tasks 1–11 present.
