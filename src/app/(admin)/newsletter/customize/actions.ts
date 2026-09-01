'use server';

import { revalidatePath } from 'next/cache';
import { createElement } from 'react';
import { render } from '@react-email/render';
import { desc } from 'drizzle-orm';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeConfigOverride } from '@/kernel/config/overrides';
import { AppearanceSchema, type Appearance } from '@/modules/newsletter/appearance/schema';
import { itemsCache } from '@/modules/newsletter/schema';
import { DigestEmail } from '@/modules/newsletter/templates/digest';
import { THEMES, DEFAULT_THEME_ID } from '@/modules/newsletter/templates/themes';
import { LAYOUTS, DEFAULT_LAYOUT_ID } from '@/modules/newsletter/templates/layouts';
import type { EnrichedItem } from '@/modules/newsletter/types';

// ---------------------------------------------------------------------------
// importAppearance — pure parse+validate only, no DB/context access
// ---------------------------------------------------------------------------

export async function importAppearance(
  json: string,
): Promise<
  | { success: true; appearance: Appearance; theme?: string; layout?: string }
  | { success: false; error: string }
> {
  await requireAdminSession();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, error: 'Invalid JSON: could not parse the uploaded file.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, error: 'Invalid format: expected a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;
  const appearanceRaw = 'appearance' in obj ? obj.appearance : obj;

  const result = AppearanceSchema.safeParse(appearanceRaw);
  if (!result.success) {
    const issues = result.error?.issues ?? [];
    const first = issues[0];
    const msg = first
      ? `Validation error${first.path.length > 0 ? ` at ${first.path.join('.')}` : ''}: ${first.message}`
      : result.error?.message || 'Invalid appearance data.';
    return { success: false, error: msg };
  }

  const theme = typeof obj.theme === 'string' ? obj.theme : undefined;
  const layout = typeof obj.layout === 'string' ? obj.layout : undefined;

  return { success: true, appearance: result.data, theme, layout };
}

// ---------------------------------------------------------------------------
// saveAppearance — validates then persists to config
// ---------------------------------------------------------------------------

export async function saveAppearance(
  appearance: unknown,
  theme: string,
  layout: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();

  const result = AppearanceSchema.safeParse(appearance);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      success: false,
      error: first
        ? `Validation error at ${first.path.join('.')}: ${first.message}`
        : 'Invalid appearance data.',
    };
  }

  const safeTheme = THEMES[theme] ? theme : DEFAULT_THEME_ID;
  const safeLayout = LAYOUTS[layout] ? layout : DEFAULT_LAYOUT_ID;

  const ctx = getAppContext();
  writeConfigOverride(ctx.db, 'newsletter', {
    ...ctx.config.newsletter,
    appearance: result.data,
    theme: safeTheme,
    layout: safeLayout,
  });
  await invalidateAppContext();

  revalidatePath('/newsletter/customize');
  revalidatePath('/newsletter/preview');
  revalidatePath('/settings');
  revalidatePath('/');

  return { success: true };
}

// ---------------------------------------------------------------------------
// renderAppearancePreview — renders DigestEmail with candidate appearance
// ---------------------------------------------------------------------------

function sampleItems(): EnrichedItem[] {
  return [
    {
      guid: 'sample-1',
      title: 'The Grand Illusion',
      mediaType: 'movie',
      libraryName: 'Movies',
      addedAt: new Date(),
      year: 1937,
      rating: 8.1,
      posterUrl: null,
      overview:
        'A film about class distinctions and human connections among prisoners of war in WWI France.',
    },
    {
      guid: 'sample-2',
      title: 'Slow Horses',
      mediaType: 'show',
      libraryName: 'TV Shows',
      addedAt: new Date(),
      year: 2022,
      rating: 8.2,
      posterUrl: null,
      overview:
        'A group of British intelligence officers who work in a dumping ground department of MI5.',
    },
    {
      guid: 'sample-3',
      title: 'Dune: Part Two',
      mediaType: 'movie',
      libraryName: 'Movies',
      addedAt: new Date(),
      year: 2024,
      rating: 8.5,
      posterUrl: null,
      overview:
        'Paul Atreides unites with Chani and the Fremen while seeking revenge against those who destroyed his family.',
    },
  ];
}

export async function renderAppearancePreview(
  appearance: unknown,
  theme: string,
  layout: string,
): Promise<{ success: true; html: string } | { success: false; error: string }> {
  await requireAdminSession();

  const parsed = AppearanceSchema.safeParse(appearance);
  if (!parsed.success) {
    return { success: false, error: 'Invalid appearance configuration.' };
  }

  const safeTheme = THEMES[theme] ? theme : DEFAULT_THEME_ID;
  const safeLayout = LAYOUTS[layout] ? layout : DEFAULT_LAYOUT_ID;

  try {
    const ctx = getAppContext();

    // Try to get items from the items cache for a realistic preview.
    // Falls back to sample items if the cache is empty.
    const cachedRows = ctx.db
      .select()
      .from(itemsCache)
      .orderBy(desc(itemsCache.addedAt))
      .limit(6)
      .all();

    const items: EnrichedItem[] =
      cachedRows.length > 0
        ? cachedRows.map(row => JSON.parse(row.payload) as EnrichedItem)
        : sampleItems();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const html = await render(
      createElement(DigestEmail, {
        items,
        appName: ctx.config.newsletter.from.name,
        windowStart: weekAgo,
        windowEnd: now,
        themeId: safeTheme,
        layoutId: safeLayout,
        unsubscribeUrl: '#',
        appearance: parsed.data,
      }),
    );

    return { success: true, html };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Preview render failed.',
    };
  }
}
