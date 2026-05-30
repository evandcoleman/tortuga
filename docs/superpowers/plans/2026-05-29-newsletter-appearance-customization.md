# Newsletter Appearance Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **PROJECT NOTE:** This is a *modified* Next.js (App Router). Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (server actions, route files). Run all commands with `pnpm`. Tests are Vitest.

**Goal:** Give admins fine-grained, no-code control over the weekly digest's appearance — editable theme fields, block reorder/hide, per-library rename/cap/layout, per-item field toggles, custom header/footer text, built-in presets, and JSON export/import — all backward-compatible with the live production config.

**Architecture:** Add one optional `appearance` object to `NewsletterConfig`. Every field is optional with defaults that reproduce today's output byte-for-byte, so the stored `config_overrides` blob keeps rendering identically until a user opts in (no Drizzle migration). The renderer (`digest.tsx`) iterates a resolved block list instead of a hardcoded order and threads `item_display`/`header`/`footer`/library rules through. A new admin page (`/newsletter/customize`) edits the appearance config with a live preview, reusing the existing `writeConfigOverride` + `invalidateAppContext` persistence.

**Tech Stack:** TypeScript, Zod, React, `@react-email/components`, Vitest, dnd-kit (admin UI only), Drizzle/SQLite (existing config store).

**Spec:** `docs/superpowers/specs/2026-05-29-newsletter-appearance-customization-design.md`

---

## File Structure

**New files**
- `src/modules/newsletter/appearance/sanitize.ts` — CSS-injection-safe validators (colors, fonts, units). Pure.
- `src/modules/newsletter/appearance/sanitize.test.ts`
- `src/modules/newsletter/appearance/schema.ts` — `AppearanceSchema` + sub-schemas + `DEFAULT_BLOCK_ORDER` + resolver helpers. Pure.
- `src/modules/newsletter/appearance/schema.test.ts`
- `src/modules/newsletter/appearance/presets.ts` — built-in preset bundles + `PRESETS` registry. Pure.
- `src/modules/newsletter/appearance/presets.test.ts`
- `src/modules/newsletter/appearance/resolve.ts` — `resolveBlocks`, `resolveItemDisplay`, `buildLibrarySections`. Pure.
- `src/modules/newsletter/appearance/resolve.test.ts`
- `src/app/(admin)/newsletter/customize/page.tsx` — server component page.
- `src/app/(admin)/newsletter/customize/actions.ts` — server actions: `saveAppearance`, `renderAppearancePreview`, `importAppearance`.
- `src/app/(admin)/newsletter/customize/actions.test.ts`
- `src/app/(admin)/newsletter/customize/CustomizeEditor.tsx` — top-level client component holding working state.
- `src/app/(admin)/newsletter/customize/BlockEditor.tsx` — dnd-kit block reorder/toggle.
- `src/app/(admin)/newsletter/customize/LibraryEditor.tsx` — per-library rules.
- `src/app/(admin)/newsletter/customize/ThemeOverridesEditor.tsx` — color/font/number controls.
- `src/app/(admin)/newsletter/customize/ItemDisplayEditor.tsx` — item field toggles + header/footer text.
- `src/app/(admin)/newsletter/customize/PresetsBar.tsx` — apply preset + export/import.
- `src/app/(admin)/newsletter/customize/LivePreview.tsx` — debounced iframe preview client component.

**Modified files**
- `src/kernel/config/schema.ts` — add `appearance: AppearanceSchema.optional()` to `NewsletterConfigSchema`.
- `src/modules/newsletter/templates/themes.ts` — add `resolveThemeWithOverrides`.
- `src/modules/newsletter/templates/digest.tsx` — accept `appearance` prop; iterate resolved blocks; apply header/footer/library/item rules.
- `src/modules/newsletter/templates/layouts/index.ts` — add `itemDisplay` to `LayoutItemsProps` + export `ItemDisplay` type re-export.
- `src/modules/newsletter/templates/layouts/list.tsx`, `gallery.tsx`, `compact.tsx`, `magazine.tsx` — honor `itemDisplay`.
- `src/modules/newsletter/pipeline/run.ts` — pass `appearance: config.appearance` into every `DigestEmail` render call.
- `src/modules/newsletter/pipeline/test-digest.ts` — pass `appearance` through (read from config).
- `src/app/(admin)/settings/SettingsForm.tsx` — add "Customize appearance →" link to the Appearance card.

---

## Canonical Types (use these EXACT names everywhere)

```typescript
// Block ids, in default render order:
export const DEFAULT_BLOCK_ORDER = ['header','intro','libraries','freeform','actions','footer'] as const;
export type BlockId = (typeof DEFAULT_BLOCK_ORDER)[number];

// All inferred from Zod (Task 2):
export type Appearance = z.infer<typeof AppearanceSchema>;
export type ThemeOverrides = z.infer<typeof ThemeOverridesSchema>;
export type LibraryRule = z.infer<typeof LibraryRuleSchema>;
export type ItemDisplay = z.infer<typeof ItemDisplaySchema>;     // all keys required after resolve
export type HeaderConfig = z.infer<typeof HeaderSchema>;
export type FooterConfig = z.infer<typeof FooterSchema>;
```

Resolver function signatures (Task 3 & 8):
```typescript
// themes.ts
export function resolveThemeWithOverrides(id: string | null | undefined, overrides?: ThemeOverrides): Theme;
// resolve.ts
export function resolveBlocks(blocks?: { id: BlockId; enabled: boolean }[]): { id: BlockId; enabled: boolean }[];
export function resolveItemDisplay(d?: Partial<ItemDisplay>): ResolvedItemDisplay;
export interface ResolvedItemDisplay { showPoster: boolean; showRating: boolean; showOverview: boolean; overviewMaxChars: number | null; posterScale: 'sm'|'md'|'lg'; }
export function posterScaleFactor(scale: 'sm'|'md'|'lg'): number; // sm 0.75, md 1, lg 1.3
export interface ResolvedSection { name: string; title: string; items: EnrichedItem[]; layoutId?: string; maxItems?: number; }
export function buildLibrarySections(items: EnrichedItem[], rules?: LibraryRule[]): ResolvedSection[];
```

---

# Phase 1 — Pure core (schema, sanitizers, resolvers, presets)

### Task 1: CSS-injection sanitizers

**Files:**
- Create: `src/modules/newsletter/appearance/sanitize.ts`
- Test: `src/modules/newsletter/appearance/sanitize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { isSafeColor, isSafeFontStack, isSafeLetterSpacing } from './sanitize';

describe('isSafeColor', () => {
  it('accepts hex, rgb, hsl, and named colors', () => {
    for (const c of ['#fff', '#ffffff', '#ffffffcc', 'rgb(0,0,0)', 'rgba(0,0,0,0.5)', 'hsl(10,50%,50%)', 'white', 'transparent']) {
      expect(isSafeColor(c)).toBe(true);
    }
  });
  it('rejects css-injection payloads', () => {
    for (const c of ['red;}', 'url(x)', 'expression(1)', '#fff;background:url(x)', 'rgb(0,0,0)/*', 'a\nb', '']) {
      expect(isSafeColor(c)).toBe(false);
    }
  });
});

describe('isSafeFontStack', () => {
  it('accepts normal font stacks', () => {
    expect(isSafeFontStack('"Inter","Helvetica",sans-serif')).toBe(true);
    expect(isSafeFontStack('Georgia, Times, serif')).toBe(true);
  });
  it('rejects braces/semicolons/parens', () => {
    for (const f of ['Inter;}', 'Inter}', 'url(x)', 'a{b', '']) expect(isSafeFontStack(f)).toBe(false);
  });
});

describe('isSafeLetterSpacing', () => {
  it('accepts em/px/rem values', () => {
    for (const v of ['-0.02em', '0.04em', '2px', '1.5rem', '0em']) expect(isSafeLetterSpacing(v)).toBe(true);
  });
  it('rejects junk', () => {
    for (const v of ['2', '2vw', 'calc(1px)', '1px;}', '']) expect(isSafeLetterSpacing(v)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/modules/newsletter/appearance/sanitize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// sanitize.ts
// Validators for user-supplied CSS values that get inlined into email style
// attributes. Reject anything that could break out of a value and inject
// arbitrary declarations. Conservative by design: better to reject a weird-but-
// valid value than to allow an injection vector.

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const HSL = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const NAMED = new Set([
  'transparent','currentcolor','black','white','red','green','blue','gray','grey',
  'silver','maroon','olive','lime','aqua','teal','navy','fuchsia','purple','orange',
  'yellow','beige','ivory','gold','brown','pink','cyan','magenta',
]);

const FORBIDDEN = /[;{}()]|url|expression|@import|\/\*|[\n\r\t<>]/i;

export function isSafeColor(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (NAMED.has(v.toLowerCase())) return true;
  if (HEX.test(v)) return true;
  // rgb/hsl contain parens, so test them BEFORE the forbidden-char gate:
  if (RGB.test(v) || HSL.test(v)) return true;
  return false;
}

export function isSafeFontStack(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length > 200) return false;
  if (FORBIDDEN.test(v)) return false;
  return /^[A-Za-z0-9 ,"'\-]+$/.test(v);
}

export function isSafeLetterSpacing(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^-?\d+(\.\d+)?(em|rem|px)$/.test(value.trim());
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm vitest run src/modules/newsletter/appearance/sanitize.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/appearance/sanitize.ts src/modules/newsletter/appearance/sanitize.test.ts
git commit -m "feat(newsletter): CSS-safe validators for appearance overrides"
```

---

### Task 2: Appearance Zod schema

**Files:**
- Create: `src/modules/newsletter/appearance/schema.ts`
- Test: `src/modules/newsletter/appearance/schema.test.ts`
- Modify: `src/kernel/config/schema.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// schema.test.ts
import { describe, it, expect } from 'vitest';
import { AppearanceSchema, DEFAULT_BLOCK_ORDER } from './schema';

describe('AppearanceSchema', () => {
  it('accepts an empty object (all optional)', () => {
    expect(AppearanceSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a full valid appearance', () => {
    const r = AppearanceSchema.safeParse({
      theme_overrides: { palette: { accent: '#123456' }, layout: { radius: 10 } },
      blocks: DEFAULT_BLOCK_ORDER.map(id => ({ id, enabled: true })),
      libraries: [{ name: 'Movies', enabled: true, title: 'Films', max_items: 5, layout: 'gallery' }],
      item_display: { show_poster: false, poster_scale: 'lg' },
      header: { eyebrow: 'Custom', show_count: false },
      footer: { text: 'Thanks', show_app_label: true },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unsafe override color', () => {
    const r = AppearanceSchema.safeParse({ theme_overrides: { palette: { accent: 'red;}' } } });
    expect(r.success).toBe(false);
  });

  it('rejects duplicate block ids', () => {
    const r = AppearanceSchema.safeParse({ blocks: [{ id: 'header', enabled: true }, { id: 'header', enabled: false }] });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown block id', () => {
    const r = AppearanceSchema.safeParse({ blocks: [{ id: 'sidebar', enabled: true }] });
    expect(r.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(AppearanceSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/modules/newsletter/appearance/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// schema.ts
import { z } from 'zod';
import { isSafeColor, isSafeFontStack, isSafeLetterSpacing } from './sanitize';

export const DEFAULT_BLOCK_ORDER = ['header', 'intro', 'libraries', 'freeform', 'actions', 'footer'] as const;
export type BlockId = (typeof DEFAULT_BLOCK_ORDER)[number];

const safeColor = z.string().refine(isSafeColor, { message: 'unsafe or invalid color' });
const safeFont = z.string().refine(isSafeFontStack, { message: 'unsafe or invalid font stack' });
const safeSpacing = z.string().refine(isSafeLetterSpacing, { message: 'invalid letter-spacing (use em/rem/px)' });

export const ThemeOverridesSchema = z
  .object({
    colorScheme: z.enum(['light', 'dark']).optional(),
    fonts: z.object({ heading: safeFont, body: safeFont }).partial().strict().optional(),
    palette: z
      .object({
        paper: safeColor, ink: safeColor, muted: safeColor, rule: safeColor, hairline: safeColor,
        accent: safeColor, onAccent: safeColor, cardBg: safeColor, chipBg: safeColor, chipFg: safeColor,
      })
      .partial().strict().optional(),
    layout: z
      .object({
        radius: z.number().min(0).max(40),
        cardBorderWidth: z.number().min(0).max(8),
        ruleWidth: z.number().min(0).max(8),
        headingWeight: z.number().int().min(100).max(900),
        headingLetterSpacing: safeSpacing,
        eyebrowLetterSpacing: z.number().min(0).max(12),
        introItalic: z.boolean(),
      })
      .partial().strict().optional(),
  })
  .strict();
export type ThemeOverrides = z.infer<typeof ThemeOverridesSchema>;

export const BlockSchema = z.object({ id: z.enum(DEFAULT_BLOCK_ORDER), enabled: z.boolean() }).strict();

export const LibraryRuleSchema = z
  .object({
    name: z.string().min(1).max(120),
    enabled: z.boolean().default(true),
    title: z.string().min(1).max(120).optional(),
    max_items: z.number().int().positive().max(100).optional(),
    layout: z.string().min(1).max(40).optional(),
  })
  .strict();
export type LibraryRule = z.infer<typeof LibraryRuleSchema>;

export const ItemDisplaySchema = z
  .object({
    show_poster: z.boolean().default(true),
    show_rating: z.boolean().default(true),
    show_overview: z.boolean().default(true),
    overview_max_chars: z.number().int().min(0).max(1000).optional(),
    poster_scale: z.enum(['sm', 'md', 'lg']).default('md'),
  })
  .strict();
export type ItemDisplay = z.infer<typeof ItemDisplaySchema>;

export const HeaderSchema = z
  .object({
    eyebrow: z.string().max(120).optional(),
    title: z.string().max(160).optional(),
    show_count: z.boolean().default(true),
    show_date_range: z.boolean().default(true),
  })
  .strict();
export type HeaderConfig = z.infer<typeof HeaderSchema>;

export const FooterSchema = z
  .object({ text: z.string().max(500).optional(), show_app_label: z.boolean().default(true) })
  .strict();
export type FooterConfig = z.infer<typeof FooterSchema>;

export const AppearanceSchema = z
  .object({
    theme_overrides: ThemeOverridesSchema.optional(),
    blocks: z
      .array(BlockSchema)
      .refine(arr => new Set(arr.map(b => b.id)).size === arr.length, { message: 'duplicate block ids' })
      .optional(),
    libraries: z.array(LibraryRuleSchema).max(100).optional(),
    item_display: ItemDisplaySchema.optional(),
    header: HeaderSchema.optional(),
    footer: FooterSchema.optional(),
  })
  .strict();
export type Appearance = z.infer<typeof AppearanceSchema>;
```

- [ ] **Step 4: Wire into the main config schema**

In `src/kernel/config/schema.ts`, add the import at the top (after `import { z }`):
```typescript
import { AppearanceSchema } from '@/modules/newsletter/appearance/schema';
```
Then inside `NewsletterConfigSchema`, immediately after the `layout: z.string().default('list'),` line (currently line 62), add:
```typescript
  appearance: AppearanceSchema.optional(),
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm vitest run src/modules/newsletter/appearance/schema.test.ts src/kernel/config`
Expected: PASS. (Existing config tests must stay green — `appearance` is optional.)

- [ ] **Step 6: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors. (If `@/` path alias fails for the new import, confirm `tsconfig.json` `paths` includes `@/* -> src/*` — it does.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/newsletter/appearance/schema.ts src/modules/newsletter/appearance/schema.test.ts src/kernel/config/schema.ts
git commit -m "feat(newsletter): appearance config schema (backward-compatible, optional)"
```

---

### Task 3: resolveThemeWithOverrides

**Files:**
- Modify: `src/modules/newsletter/templates/themes.ts`
- Test: `src/modules/newsletter/templates/themes.test.ts` (append cases)

- [ ] **Step 1: Write the failing test (append to themes.test.ts)**

```typescript
import { resolveThemeWithOverrides, resolveTheme } from './themes';

describe('resolveThemeWithOverrides', () => {
  it('returns the base theme unchanged when no overrides', () => {
    expect(resolveThemeWithOverrides('editorial')).toEqual(resolveTheme('editorial'));
  });
  it('deep-merges palette and layout, leaving other fields intact', () => {
    const base = resolveTheme('editorial');
    const t = resolveThemeWithOverrides('editorial', { palette: { accent: '#123456' }, layout: { radius: 12 } });
    expect(t.palette.accent).toBe('#123456');
    expect(t.palette.ink).toBe(base.palette.ink);         // untouched
    expect(t.layout.radius).toBe(12);
    expect(t.layout.ruleWidth).toBe(base.layout.ruleWidth); // untouched
  });
  it('overrides fonts and colorScheme', () => {
    const t = resolveThemeWithOverrides('editorial', { colorScheme: 'dark', fonts: { heading: 'Georgia, serif' } });
    expect(t.colorScheme).toBe('dark');
    expect(t.fonts.heading).toBe('Georgia, serif');
  });
  it('falls back to default theme for unknown id', () => {
    expect(resolveThemeWithOverrides('nope').id).toBe(resolveTheme(null).id);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run src/modules/newsletter/templates/themes.test.ts`
Expected: FAIL — `resolveThemeWithOverrides` not exported.

- [ ] **Step 3: Implement (append to themes.ts)**

```typescript
import type { ThemeOverrides } from '../appearance/schema';

export function resolveThemeWithOverrides(id?: string | null, overrides?: ThemeOverrides): Theme {
  const base = resolveTheme(id);
  if (!overrides) return base;
  return {
    ...base,
    colorScheme: overrides.colorScheme ?? base.colorScheme,
    fonts: { ...base.fonts, ...(overrides.fonts ?? {}) },
    palette: { ...base.palette, ...(overrides.palette ?? {}) },
    layout: { ...base.layout, ...(overrides.layout ?? {}) },
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm vitest run src/modules/newsletter/templates/themes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/templates/themes.ts src/modules/newsletter/templates/themes.test.ts
git commit -m "feat(newsletter): resolveThemeWithOverrides deep-merge"
```

---

### Task 4: Resolvers (blocks, item display, library sections)

**Files:**
- Create: `src/modules/newsletter/appearance/resolve.ts`
- Test: `src/modules/newsletter/appearance/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveBlocks, resolveItemDisplay, posterScaleFactor, buildLibrarySections } from './resolve';
import { DEFAULT_BLOCK_ORDER } from './schema';
import type { EnrichedItem } from '../types';

const item = (libraryName: string, guid: string): EnrichedItem =>
  ({ guid, libraryName } as unknown as EnrichedItem);

describe('resolveBlocks', () => {
  it('returns the default order all-enabled when undefined', () => {
    expect(resolveBlocks()).toEqual(DEFAULT_BLOCK_ORDER.map(id => ({ id, enabled: true })));
  });
  it('respects a provided order and appends any missing blocks as enabled', () => {
    const r = resolveBlocks([{ id: 'footer', enabled: true }, { id: 'header', enabled: false }]);
    expect(r[0]).toEqual({ id: 'footer', enabled: true });
    expect(r[1]).toEqual({ id: 'header', enabled: false });
    expect(r.map(b => b.id).sort()).toEqual([...DEFAULT_BLOCK_ORDER].sort()); // all present
  });
});

describe('resolveItemDisplay', () => {
  it('defaults to all-shown, md, null overview cap', () => {
    expect(resolveItemDisplay()).toEqual({
      showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
    });
  });
  it('maps snake_case config to camelCase resolved', () => {
    const r = resolveItemDisplay({ show_poster: false, overview_max_chars: 100, poster_scale: 'lg' });
    expect(r).toEqual({ showPoster: false, showRating: true, showOverview: true, overviewMaxChars: 100, posterScale: 'lg' });
  });
});

describe('posterScaleFactor', () => {
  it('maps scale tokens to multipliers', () => {
    expect(posterScaleFactor('sm')).toBeCloseTo(0.75);
    expect(posterScaleFactor('md')).toBe(1);
    expect(posterScaleFactor('lg')).toBeCloseTo(1.3);
  });
});

describe('buildLibrarySections', () => {
  const items = [item('Movies', 'a'), item('TV', 'b'), item('Movies', 'c'), item('Music', 'd')];

  it('groups by library in first-seen order when no rules', () => {
    const s = buildLibrarySections(items);
    expect(s.map(x => x.name)).toEqual(['Movies', 'TV', 'Music']);
    expect(s.map(x => x.title)).toEqual(['Movies', 'TV', 'Music']);
    expect(s[0].items).toHaveLength(2);
  });
  it('orders by rules, renames, hides, caps, and appends unlisted', () => {
    const s = buildLibrarySections(items, [
      { name: 'Music', enabled: true, title: 'Tunes' },
      { name: 'TV', enabled: false },
      { name: 'Movies', enabled: true, max_items: 1, layout: 'gallery' },
    ]);
    expect(s.map(x => x.name)).toEqual(['Music', 'Movies']); // TV hidden, listed order, no unlisted left
    expect(s[0].title).toBe('Tunes');
    expect(s[1].items).toHaveLength(1);     // capped
    expect(s[1].layoutId).toBe('gallery');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run src/modules/newsletter/appearance/resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// resolve.ts
import type { EnrichedItem } from '../types';
import { DEFAULT_BLOCK_ORDER, type BlockId, type ItemDisplay, type LibraryRule } from './schema';

export interface ResolvedItemDisplay {
  showPoster: boolean;
  showRating: boolean;
  showOverview: boolean;
  overviewMaxChars: number | null;
  posterScale: 'sm' | 'md' | 'lg';
}

export function resolveBlocks(blocks?: { id: BlockId; enabled: boolean }[]): { id: BlockId; enabled: boolean }[] {
  if (!blocks || blocks.length === 0) return DEFAULT_BLOCK_ORDER.map(id => ({ id, enabled: true }));
  const seen = new Set(blocks.map(b => b.id));
  const missing = DEFAULT_BLOCK_ORDER.filter(id => !seen.has(id)).map(id => ({ id, enabled: true }));
  return [...blocks, ...missing];
}

export function resolveItemDisplay(d?: Partial<ItemDisplay>): ResolvedItemDisplay {
  return {
    showPoster: d?.show_poster ?? true,
    showRating: d?.show_rating ?? true,
    showOverview: d?.show_overview ?? true,
    overviewMaxChars: d?.overview_max_chars ?? null,
    posterScale: d?.poster_scale ?? 'md',
  };
}

export function posterScaleFactor(scale: 'sm' | 'md' | 'lg'): number {
  return scale === 'sm' ? 0.75 : scale === 'lg' ? 1.3 : 1;
}

export interface ResolvedSection {
  name: string;
  title: string;
  items: EnrichedItem[];
  layoutId?: string;
  maxItems?: number;
}

export function buildLibrarySections(items: EnrichedItem[], rules?: LibraryRule[]): ResolvedSection[] {
  const groups = new Map<string, EnrichedItem[]>();
  for (const it of items) {
    const list = groups.get(it.libraryName) ?? [];
    list.push(it);
    groups.set(it.libraryName, list);
  }

  if (!rules || rules.length === 0) {
    return Array.from(groups.entries()).map(([name, list]) => ({ name, title: name, items: list }));
  }

  const result: ResolvedSection[] = [];
  const used = new Set<string>();
  for (const rule of rules) {
    const list = groups.get(rule.name);
    used.add(rule.name);
    if (!list || rule.enabled === false) continue;
    const capped = rule.max_items ? list.slice(0, rule.max_items) : list;
    result.push({ name: rule.name, title: rule.title ?? rule.name, items: capped, layoutId: rule.layout, maxItems: rule.max_items });
  }
  // Append libraries not covered by any rule, in first-seen order.
  for (const [name, list] of groups.entries()) {
    if (used.has(name)) continue;
    result.push({ name, title: name, items: list });
  }
  return result;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm vitest run src/modules/newsletter/appearance/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/appearance/resolve.ts src/modules/newsletter/appearance/resolve.test.ts
git commit -m "feat(newsletter): appearance resolvers (blocks, item display, library sections)"
```

---

### Task 5: Built-in presets

**Files:**
- Create: `src/modules/newsletter/appearance/presets.ts`
- Test: `src/modules/newsletter/appearance/presets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// presets.test.ts
import { describe, it, expect } from 'vitest';
import { PRESETS, PRESET_OPTIONS } from './presets';
import { AppearanceSchema } from './schema';

describe('presets', () => {
  it('exposes options for the UI', () => {
    expect(PRESET_OPTIONS.length).toBeGreaterThanOrEqual(4);
    expect(PRESET_OPTIONS.every(o => o.value && o.label)).toBe(true);
  });
  it('every preset has a valid appearance and theme/layout ids', () => {
    for (const p of Object.values(PRESETS)) {
      expect(AppearanceSchema.safeParse(p.appearance).success).toBe(true);
      expect(typeof p.theme).toBe('string');
      expect(typeof p.layout).toBe('string');
    }
  });
  it('editorial-classic is the byte-for-byte baseline (empty appearance + default ids)', () => {
    const p = PRESETS['editorial-classic'];
    expect(p.theme).toBe('editorial');
    expect(p.layout).toBe('list');
    expect(p.appearance).toEqual({});
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run src/modules/newsletter/appearance/presets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// presets.ts
import type { Appearance } from './schema';

export interface AppearancePreset {
  id: string;
  label: string;
  description: string;
  theme: string;
  layout: string;
  appearance: Appearance;
}

export const PRESETS: Record<string, AppearancePreset> = {
  'editorial-classic': {
    id: 'editorial-classic',
    label: 'Editorial Classic',
    description: "The default look. A clean reset baseline.",
    theme: 'editorial',
    layout: 'list',
    appearance: {},
  },
  minimalist: {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Compact rows, no overview text, small posters.',
    theme: 'swiss',
    layout: 'compact',
    appearance: {
      item_display: { show_overview: false, poster_scale: 'sm', show_poster: true, show_rating: true },
    },
  },
  'gallery-wall': {
    id: 'gallery-wall',
    label: 'Gallery Wall',
    description: 'Poster-forward grid, ratings hidden.',
    theme: 'editorial',
    layout: 'gallery',
    appearance: {
      item_display: { show_rating: false, poster_scale: 'lg', show_poster: true, show_overview: true },
    },
  },
  'dark-luxury': {
    id: 'dark-luxury',
    label: 'Dark Luxury',
    description: 'Dark palette with gold accents and serif headings.',
    theme: 'dark-luxury',
    layout: 'list',
    appearance: {
      theme_overrides: { layout: { radius: 10 } },
    },
  },
};

export const PRESET_OPTIONS = Object.values(PRESETS).map(p => ({ value: p.id, label: p.label }));
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm vitest run src/modules/newsletter/appearance/presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/appearance/presets.ts src/modules/newsletter/appearance/presets.test.ts
git commit -m "feat(newsletter): built-in appearance presets"
```

---

# Phase 2 — Render threading

### Task 6: Thread item display into layouts

**Files:**
- Modify: `src/modules/newsletter/templates/layouts/index.ts`
- Modify: `src/modules/newsletter/templates/layouts/list.tsx`, `gallery.tsx`, `compact.tsx`, `magazine.tsx`
- Test: `src/modules/newsletter/templates/layouts/index.test.ts` (append)

**Context:** Each layout currently destructures `{ items, theme }` from `LayoutItemsProps` and hardcodes poster dimensions, the 220/360 overview truncation, and `item.rating > 0`. Add an optional `itemDisplay` prop. When absent, behavior is unchanged.

- [ ] **Step 1: Write the failing test (append to index.test.ts)**

```typescript
import { render } from '@react-email/render';
import { createElement } from 'react';
import { resolveTheme } from '../themes';
import { ListItems } from './list';

const theme = resolveTheme('editorial');
const baseItem = {
  guid: 'g1', libraryName: 'Movies', title: 'X', mediaType: 'movie',
  overview: 'o'.repeat(400), rating: 8.1, posterUrl: 'http://x/p.jpg', year: 2020,
} as any;

describe('ListItems itemDisplay', () => {
  it('hides the poster when showPoster is false', async () => {
    const html = await render(createElement(ListItems, {
      items: [baseItem], theme,
      itemDisplay: { showPoster: false, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md' },
    }));
    expect(html).not.toContain('p.jpg');
  });
  it('omits overview text when showOverview is false', async () => {
    const html = await render(createElement(ListItems, {
      items: [baseItem], theme,
      itemDisplay: { showPoster: true, showRating: true, showOverview: false, overviewMaxChars: null, posterScale: 'md' },
    }));
    expect(html).not.toContain('oooo');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run src/modules/newsletter/templates/layouts/index.test.ts`
Expected: FAIL — `itemDisplay` not a prop / poster still rendered.

- [ ] **Step 3: Update the shared prop type**

In `layouts/index.ts`, extend `LayoutItemsProps` and re-export the resolved type:
```typescript
import type { ResolvedItemDisplay } from '../../appearance/resolve';
export type { ResolvedItemDisplay } from '../../appearance/resolve';

export interface LayoutItemsProps {
  items: EnrichedItem[];
  theme: Theme;
  itemDisplay?: ResolvedItemDisplay;
}
```

- [ ] **Step 4: Implement per-layout honoring (do all four)**

For EACH of `list.tsx`, `gallery.tsx`, `compact.tsx`, `magazine.tsx`:
1. Destructure `itemDisplay` from props and compute a resolved default at the top of the component:
```typescript
import { posterScaleFactor, type ResolvedItemDisplay } from './index';

const DEFAULT_DISPLAY: ResolvedItemDisplay = { showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md' };
```
2. In the item renderer, read `const d = itemDisplay ?? DEFAULT_DISPLAY;`
3. Poster: wrap the `<Img>`/placeholder render in `d.showPoster && (...)`. Multiply the existing hardcoded width/height by `posterScaleFactor(d.posterScale)` (round with `Math.round`). For layouts using a fixed `Column` width (list: `width: 104`), scale that too; when `!d.showPoster`, omit the poster Column entirely.
4. Overview: gate behind `d.showOverview`; replace the hardcoded truncation length with `truncate(item.overview, d.overviewMaxChars ?? <existing default for this layout>)` — list/compact use `220`, magazine uses `360`. (compact currently shows no overview — leave it that way; only gate if it renders one.)
5. Rating: change `const showsRating = item.rating > 0;` to `const showsRating = d.showRating && item.rating > 0;`

> Keep all existing inline styles otherwise identical. The `?? DEFAULT_DISPLAY` guarantees byte-for-byte output when no `itemDisplay` is passed.

- [ ] **Step 5: Run, verify pass + existing snapshots green**

Run: `pnpm vitest run src/modules/newsletter/templates`
Expected: PASS. Existing `digest.test.ts` / layout snapshots unchanged (no `itemDisplay` passed yet).

- [ ] **Step 6: Commit**

```bash
git add src/modules/newsletter/templates/layouts
git commit -m "feat(newsletter): per-item display options in all layouts"
```

---

### Task 7: Thread appearance into DigestEmail

**Files:**
- Modify: `src/modules/newsletter/templates/digest.tsx`
- Test: `src/modules/newsletter/templates/digest.test.ts` (append)

**Context:** `DigestEmail` currently hardcodes section order and content. Refactor so it:
1. Accepts `appearance?: Appearance`.
2. Resolves the theme via `resolveThemeWithOverrides(themeId, appearance?.theme_overrides)`.
3. Builds each block as a local `const` React node, then renders them in `resolveBlocks(appearance?.blocks)` order, skipping disabled blocks and blocks with no content.
4. Applies `appearance?.header` / `appearance?.footer` to the header/footer nodes.
5. Builds library sections via `buildLibrarySections(items, appearance?.libraries)`, resolving each section's layout with `resolveLayout(section.layoutId ?? layoutId)` and passing `resolveItemDisplay(appearance?.item_display)` to the layout.

- [ ] **Step 1: Write the failing test (append to digest.test.ts)**

```typescript
import { render } from '@react-email/render';
import { createElement } from 'react';
import { DigestEmail } from './digest';

const items = [
  { guid: 'a', libraryName: 'Movies', title: 'Alpha', mediaType: 'movie', overview: 'x', rating: 0, posterUrl: '', year: 2020 },
  { guid: 'b', libraryName: 'TV', title: 'Beta', mediaType: 'show', overview: 'y', rating: 0, posterUrl: '', year: 2021 },
] as any[];

const base = { items, unsubscribeUrl: 'http://u/x', appName: 'Plex', windowStart: new Date('2026-05-20'), windowEnd: new Date('2026-05-27') };

describe('DigestEmail appearance', () => {
  it('renders identically when appearance is undefined (parity)', async () => {
    const a = await render(createElement(DigestEmail, base));
    const b = await render(createElement(DigestEmail, { ...base, appearance: {} }));
    expect(a).toBe(b);
  });
  it('hides a block when disabled', async () => {
    const html = await render(createElement(DigestEmail, {
      ...base,
      appearance: { blocks: [{ id: 'footer', enabled: false }] },
    }));
    expect(html).not.toContain('Unsubscribe'); // EXPECTED TO FAIL FIRST: see note
  });
  it('applies a custom header title and hides the count', async () => {
    const html = await render(createElement(DigestEmail, {
      ...base,
      appearance: { header: { title: 'Fresh Picks', show_count: false, show_date_range: true } },
    }));
    expect(html).toContain('Fresh Picks');
  });
  it('reorders and renames library sections', async () => {
    const html = await render(createElement(DigestEmail, {
      ...base,
      appearance: { libraries: [{ name: 'TV', enabled: true, title: 'Shows' }, { name: 'Movies', enabled: true }] },
    }));
    expect(html.indexOf('Shows')).toBeLessThan(html.indexOf('Movies'));
  });
});
```

> **NOTE on the footer test:** the spec says unsubscribe is never removable. The `footer` *block* can be hidden, but if hiding the footer block also removes the unsubscribe link that violates compliance. Resolve this in implementation: the **unsubscribe line is rendered OUTSIDE the toggleable footer block** (always last), and the `footer` block only controls the app-label + custom footer text. **Update the disabled-block test to assert the app label is gone but `Unsubscribe` remains:**
> ```typescript
> expect(html).toContain('Unsubscribe');
> expect(html).not.toContain('>Plex<'); // app-label text removed
> ```
> Use this corrected assertion.

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run src/modules/newsletter/templates/digest.test.ts`
Expected: FAIL on the new appearance cases.

- [ ] **Step 3: Implement the refactor**

Edit `digest.tsx`:
1. Imports:
```typescript
import { resolveThemeWithOverrides } from './themes';
import { buildLibrarySections, resolveBlocks, resolveItemDisplay } from '../appearance/resolve';
import type { Appearance } from '../appearance/schema';
```
2. Add `appearance?: Appearance;` to `DigestEmailProps`.
3. In the component, replace `const theme = resolveTheme(themeId);` with:
```typescript
const theme = resolveThemeWithOverrides(themeId, appearance?.theme_overrides);
const itemDisplay = resolveItemDisplay(appearance?.item_display);
const header = appearance?.header;
const footer = appearance?.footer;
const sections = buildLibrarySections(items, appearance?.libraries);
```
   (Delete the old `Map`-based `sections` builder.)
4. Build each block as a node. Header node uses overrides:
   - eyebrow text: `{header?.eyebrow ?? \`${appName} · Weekly\`}`
   - h1 text: `{header?.title ?? \`New on ${appName}\`}`
   - meta line: render only the enabled parts — `show_date_range !== false` → date range; `show_count !== false` → `{items.length} {itemNoun}`; join with ` · ` when both present; render the `<Text>` only if at least one part shows.
5. Intro node: existing intro markup (unchanged), already returns null when no `intro`.
6. Libraries node: map over `sections`; each uses `const SectionLayout = resolveLayout(section.layoutId ?? layoutId);` and `<SectionLayout.Items items={section.items} theme={theme} itemDisplay={itemDisplay} />`, and renders `section.title` instead of the raw library name.
7. Freeform node: existing markup, null when no `freeformHtml`.
8. Actions node: existing request/personal markup, null when neither link.
9. Footer node: the app-label `<Text>` rendered only if `footer?.show_app_label !== false`; add an optional custom `footer.text` line below it when present. **The unsubscribe `<Text>` block stays separate and always renders.**
10. Assemble:
```typescript
const blockNodes: Record<BlockId, React.ReactNode> = {
  header: headerNode, intro: introNode, libraries: librariesNode,
  freeform: freeformNode, actions: actionsNode, footer: footerNode,
};
const ordered = resolveBlocks(appearance?.blocks);
// inside <Container>:
{ordered.filter(b => b.enabled).map(b => <React.Fragment key={b.id}>{blockNodes[b.id]}</React.Fragment>)}
{/* divider + unsubscribe ALWAYS here, after blocks */}
```
   Import `BlockId`: `import { DEFAULT_BLOCK_ORDER, type BlockId } from '../appearance/schema';`
   Preserve the existing inter-section dividers/margins so default output is unchanged. The top divider (the `<Hr>` after intro, current line 175) belongs to the `libraries` block's leading edge — keep it as the first child of `librariesNode` so hiding libraries hides its divider too.

> **Parity is the bar:** the `appearance: {}` vs `undefined` test (Step 1) and ALL existing snapshots must pass with output unchanged. If a snapshot diffs, the refactor changed default output — fix until identical.

- [ ] **Step 4: Run, verify pass**

Run: `pnpm vitest run src/modules/newsletter/templates`
Expected: PASS, including existing snapshots unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/templates/digest.tsx src/modules/newsletter/templates/digest.test.ts
git commit -m "feat(newsletter): block-ordered rendering with header/footer/library/item appearance"
```

---

### Task 8: Pass appearance from the pipeline

**Files:**
- Modify: `src/modules/newsletter/pipeline/run.ts` (every `createElement(DigestEmail, {...})` — lines ~115, ~131, ~165)
- Modify: `src/modules/newsletter/pipeline/test-digest.ts`
- Test: `src/modules/newsletter/pipeline/run.test.ts` (if present) or add a focused assertion

- [ ] **Step 1: Add `appearance: config.appearance` to each DigestEmail props object in run.ts**

For each of the three `createElement(DigestEmail, { ... })` call sites, add `appearance: config.appearance,` to the props object. (`config` is the `NewsletterConfig` already in scope in `runDigest`.)

- [ ] **Step 2: Thread appearance through test-digest.ts**

`renderAndSendTestDigest` re-renders a stored digest with a chosen theme/layout. Add an optional `appearance?: Appearance` to its params and pass it into the `DigestEmail` render. In `preview/actions.ts::sendTestDigest`, pass `appearance: ctx.config.newsletter.appearance`. Import the `Appearance` type from `@/modules/newsletter/appearance/schema`.

- [ ] **Step 3: Run the full suite**

Run: `pnpm vitest run`
Expected: PASS. No behavior change yet for existing configs (appearance is undefined in prod).

- [ ] **Step 4: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/pipeline/run.ts src/modules/newsletter/pipeline/test-digest.ts "src/app/(admin)/newsletter/preview/actions.ts"
git commit -m "feat(newsletter): wire appearance config through the render pipeline"
```

---

# Phase 3 — Admin UI

### Task 9: Add dnd-kit dependency

**Files:** `package.json`

- [ ] **Step 1: Install**

Run: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: added to dependencies; lockfile updated.

- [ ] **Step 2: Verify build still resolves**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add dnd-kit for the appearance block editor"
```

---

### Task 10: Customize server actions

**Files:**
- Create: `src/app/(admin)/newsletter/customize/actions.ts`
- Test: `src/app/(admin)/newsletter/customize/actions.test.ts`

**Context:** Read existing patterns in `src/app/(admin)/newsletter/preview/actions.ts` (`getAppContext`, `writeConfigOverride`, `invalidateAppContext`, `revalidatePath`) and `src/modules/newsletter/pipeline/run.ts` for how a digest is rendered to HTML (`render(createElement(DigestEmail, {...}))`). Read `node_modules/next/dist/docs/` for current server-action conventions before writing.

Three actions:
- `saveAppearance(appearance: unknown, theme: string, layout: string): Promise<{ success: boolean; error?: string }>` — validate `appearance` with `AppearanceSchema`, then `writeConfigOverride(db, { ...ctx.config.newsletter, appearance: parsed, theme, layout })`, `invalidateAppContext()`, revalidate `/newsletter/customize`, `/newsletter/preview`, `/settings`, `/`.
- `renderAppearancePreview(appearance: unknown, theme: string, layout: string): Promise<{ success: true; html: string } | { success: false; error: string }>` — validate, then render the latest stored `rendered` digest's items (or a small built-in sample if none) through `DigestEmail` with the candidate appearance/theme/layout and return HTML. Does NOT persist anything.
- `importAppearance(json: string): Promise<{ success: true; appearance: Appearance; theme?: string; layout?: string } | { success: false; error: string }>` — `JSON.parse` in try/catch, validate the `appearance` field with `AppearanceSchema`; return parsed value or a field-level error string. No persistence (the client loads it into working state, user clicks Save).

- [ ] **Step 1: Write the failing test**

```typescript
// actions.test.ts
import { describe, it, expect } from 'vitest';
import { importAppearance } from './actions';

describe('importAppearance', () => {
  it('parses a valid appearance JSON', async () => {
    const r = await importAppearance(JSON.stringify({ appearance: { item_display: { show_poster: false } }, theme: 'swiss', layout: 'compact' }));
    expect(r.success).toBe(true);
    if (r.success) { expect(r.theme).toBe('swiss'); expect(r.appearance.item_display?.show_poster).toBe(false); }
  });
  it('rejects malformed JSON', async () => {
    const r = await importAppearance('{ not json');
    expect(r.success).toBe(false);
  });
  it('rejects an unsafe color in imported JSON', async () => {
    const r = await importAppearance(JSON.stringify({ appearance: { theme_overrides: { palette: { accent: 'red;}' } } } }));
    expect(r.success).toBe(false);
  });
});
```

> `importAppearance` must be free of `getAppContext()` side effects so it's unit-testable without a DB. Keep parsing/validation pure inside it; only `saveAppearance`/`renderAppearancePreview` touch context.

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run "src/app/(admin)/newsletter/customize/actions.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (`'use server'` at top). Use the contracts above; mirror error-handling style from `preview/actions.ts`. For `renderAppearancePreview`, import `render` from `@react-email/render` and `DigestEmail` from `@/modules/newsletter/templates/digest`; reuse the latest `digests` row's stored items if the pipeline persists them, else construct 2–3 sample `EnrichedItem`s in a small local `sampleItems()` helper so the preview always renders.

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `pnpm vitest run "src/app/(admin)/newsletter/customize/actions.test.ts" && pnpm tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/newsletter/customize/actions.ts" "src/app/(admin)/newsletter/customize/actions.test.ts"
git commit -m "feat(newsletter): customize server actions (save/preview/import)"
```

---

### Task 11: Block editor (dnd-kit)

**Files:**
- Create: `src/app/(admin)/newsletter/customize/BlockEditor.tsx`

**Context:** Read an existing client component for conventions (e.g. `src/app/(admin)/newsletter/preview/PreviewSwitcher.tsx`, and `RecipientRow.tsx` for `'use client'` + state). dnd-kit usage: `DndContext` + `SortableContext` (verticalListSortingStrategy) + `useSortable` per row + keyboard sensor for a11y.

- [ ] **Step 1: Implement the component**

```tsx
'use client';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BlockId } from '@/modules/newsletter/appearance/schema';

const LABELS: Record<BlockId, string> = {
  header: 'Header', intro: 'AI intro', libraries: 'Library sections',
  freeform: 'Freeform block', actions: 'Action buttons', footer: 'Footer',
};

export interface BlockState { id: BlockId; enabled: boolean }
interface Props { blocks: BlockState[]; onChange: (next: BlockState[]) => void }

export function BlockEditor({ blocks, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (over && active.id !== over.id) {
        const oldI = blocks.findIndex(b => b.id === active.id);
        const newI = blocks.findIndex(b => b.id === over.id);
        onChange(arrayMove(blocks, oldI, newI));
      }
    }}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {blocks.map(b => (
            <SortableRow key={b.id} block={b} onToggle={() =>
              onChange(blocks.map(x => x.id === b.id ? { ...x, enabled: !x.enabled } : x))} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ block, onToggle }: { block: BlockState; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, marginBottom: 8, background: '#fff' }}>
      <button type="button" aria-label="Drag to reorder" {...attributes} {...listeners} style={{ cursor: 'grab', border: 'none', background: 'none', fontSize: 18 }}>⠿</button>
      <span style={{ flex: 1 }}>{LABELS[block.id]}</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <input type="checkbox" checked={block.enabled} onChange={onToggle} /> Visible
      </label>
    </li>
  );
}
```

> Match the project's actual CSS approach (Tailwind classes vs inline). Inspect a sibling client component first and follow it; the inline styles above are a fallback if no utility system is in use.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/newsletter/customize/BlockEditor.tsx"
git commit -m "feat(newsletter): drag-and-drop block editor"
```

---

### Task 12: Library, theme-overrides, item-display & presets editors

**Files:**
- Create: `LibraryEditor.tsx`, `ThemeOverridesEditor.tsx`, `ItemDisplayEditor.tsx`, `PresetsBar.tsx` (all in `customize/`)

**Context:** Controlled components — each takes its slice of working state + an `onChange`. Reuse existing UI primitives from `src/app/(admin)/_components/ui` (look up `Card`, `TextField`, `SelectField` exports) for visual consistency. Pull `THEME_OPTIONS`/`LAYOUT_OPTIONS` from the theme/layout registries, `PRESET_OPTIONS`/`PRESETS` from `appearance/presets`.

- [ ] **Step 1: Implement `LibraryEditor.tsx`** — list of `LibraryRule` rows: text input (rename → `title`), number input (`max_items`), layout `<select>` (`LAYOUT_OPTIONS` + "Default"), visible checkbox, up/down reorder buttons, remove button; plus an "Add library" text input (free-text `name`). Known library names passed in via a `knownLibraries: string[]` prop (page supplies from cache). Emits `LibraryRule[]`.

- [ ] **Step 2: Implement `ThemeOverridesEditor.tsx`** — grouped, collapsible. Palette: 10 color rows, each a text input (+ `<input type="color">` swatch where the value is a hex). Fonts: heading/body text inputs. Layout knobs: number inputs for `radius`, `cardBorderWidth`, `ruleWidth`, `headingWeight`, `eyebrowLetterSpacing`; text input for `headingLetterSpacing`; checkbox for `introItalic`. Each field writes into a `ThemeOverrides`-shaped object; **leave a field unset (undefined) when the input is blank** so unset = inherit base theme. Show inline validation using the `isSafe*` helpers (import from `appearance/sanitize`) and mark invalid fields; don't block typing, just flag.

- [ ] **Step 3: Implement `ItemDisplayEditor.tsx`** — checkboxes for `show_poster`/`show_rating`/`show_overview`, number input for `overview_max_chars` (blank = default), segmented control / `<select>` for `poster_scale` (sm/md/lg). Also render header fields (`eyebrow`, `title` text inputs; `show_count`, `show_date_range` checkboxes) and footer fields (`text`, `show_app_label`) here under sub-headings, or split into a sibling — keep it one file if under 300 lines.

- [ ] **Step 4: Implement `PresetsBar.tsx`** — a row of preset buttons (`PRESET_OPTIONS`); clicking calls `onApplyPreset(presetId)` (parent merges `PRESETS[id]`). Export button: serializes current `{ appearance, theme, layout }` to a JSON blob and triggers a download (`Blob` + anchor). Import button: hidden `<input type="file">`; on file read, calls `onImport(text)` (parent calls the `importAppearance` action).

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/newsletter/customize/LibraryEditor.tsx" "src/app/(admin)/newsletter/customize/ThemeOverridesEditor.tsx" "src/app/(admin)/newsletter/customize/ItemDisplayEditor.tsx" "src/app/(admin)/newsletter/customize/PresetsBar.tsx"
git commit -m "feat(newsletter): library, theme-override, item-display, and presets editors"
```

---

### Task 13: Live preview + editor shell + page

**Files:**
- Create: `LivePreview.tsx`, `CustomizeEditor.tsx`, `page.tsx` (all in `customize/`)

- [ ] **Step 1: Implement `LivePreview.tsx`** — `'use client'`. Props: `appearance`, `theme`, `layout`. On change (debounced ~400ms via a `useEffect` + `setTimeout`), calls the `renderAppearancePreview` server action and writes the returned HTML into an `<iframe srcDoc={html}>`. Show a subtle "updating…" state during the in-flight transition (`useTransition`). Handle the error branch by showing the error text instead of swapping the iframe.

- [ ] **Step 2: Implement `CustomizeEditor.tsx`** — `'use client'`. Holds the single working-state object `{ appearance: Appearance; theme: string; layout: string }` initialized from props (server-provided current config). Renders: theme/layout `SelectField`s, `PresetsBar`, `BlockEditor`, `LibraryEditor`, `ThemeOverridesEditor`, `ItemDisplayEditor`, and `LivePreview` (sticky/side column). A "Save as default" button calls the `saveAppearance` action with current state and shows success/error. Apply-preset merges `PRESETS[id]` into working state. Import calls `importAppearance` and loads the result. `blocks` working state is initialized via `resolveBlocks(appearance.blocks)` so the editor always shows all six rows.

- [ ] **Step 3: Implement `page.tsx`** — server component, `export const dynamic = 'force-dynamic'`. Read `node_modules/next/dist/docs/` for current page/server-action wiring. Load `ctx.config.newsletter` (theme, layout, appearance) and `knownLibraries` from the recipients/preview cache or the latest digest's items; pass all into `<CustomizeEditor />`. Wrap in the standard `PageHeader` + `Card` shell used by sibling pages.

- [ ] **Step 4: Typecheck + build**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: clean build (this catches server/client boundary mistakes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/newsletter/customize/LivePreview.tsx" "src/app/(admin)/newsletter/customize/CustomizeEditor.tsx" "src/app/(admin)/newsletter/customize/page.tsx"
git commit -m "feat(newsletter): customize page with live preview"
```

---

### Task 14: Link from Settings

**Files:**
- Modify: `src/app/(admin)/settings/SettingsForm.tsx`

- [ ] **Step 1: Add a link** in the "Appearance" card (after the theme/layout selects) pointing to `/newsletter/customize`, labeled "Customize appearance →". Use the existing link/anchor style in the file.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/settings/SettingsForm.tsx"
git commit -m "feat(settings): link to newsletter appearance customizer"
```

---

# Phase 4 — Verification

### Task 15: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `pnpm vitest run`
Expected: ALL pass. Existing newsletter snapshots unchanged (parity).

- [ ] **Step 2: Typecheck, lint, build**

Run: `pnpm tsc --noEmit && pnpm eslint . && pnpm build`
Expected: clean.

- [ ] **Step 3: Coverage check (≥80% on new appearance modules)**

Run: `pnpm vitest run --coverage src/modules/newsletter/appearance`
Expected: ≥80% lines on the appearance modules. Add tests if short.

- [ ] **Step 4: Manual smoke (optional, local)** — start dev server, open `/newsletter/customize`, reorder a block, toggle a poster, apply a preset, confirm live preview updates and "Save as default" persists.

---

## Self-Review (completed by plan author)

- **Spec coverage:** theme_overrides → Tasks 2,3,12; blocks/drag-drop → Tasks 2,4,7,11; libraries → Tasks 2,4,7,12; item_display → Tasks 2,4,6,7,12; header/footer → Tasks 2,7,12; CSS sanitizers → Task 1; presets → Task 5,12; export/import → Tasks 10,12; live preview → Tasks 10,13; settings link → Task 14; testing/parity → throughout + Task 15. No migration (config blob) — stated in header. ✔ all spec sections mapped.
- **Placeholders:** none — pure modules have full code; render/UI tasks give exact contracts + key code and point at real sibling files to mirror.
- **Type consistency:** `Appearance`, `ThemeOverrides`, `LibraryRule`, `ItemDisplay`, `ResolvedItemDisplay`, `BlockId`, `ResolvedSection`, `resolveThemeWithOverrides`, `resolveBlocks`, `resolveItemDisplay`, `posterScaleFactor`, `buildLibrarySections` — names consistent across tasks.
- **Known follow-through for executor:** in Task 7, the unsubscribe line must render outside the toggleable footer block (compliance) — corrected assertion provided inline.
