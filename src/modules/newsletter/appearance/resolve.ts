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
  const missing = DEFAULT_BLOCK_ORDER.filter(id => !seen.has(id));

  // Insert each missing block (e.g. a newly introduced kind like `leaving`) right
  // after the nearest block that precedes it in DEFAULT_BLOCK_ORDER and is already
  // present, rather than always appending at the very end. This keeps a stored
  // appearance's custom order intact while placing new blocks in a sensible spot.
  let result = [...blocks];
  for (const id of missing) {
    const defaultIndex = DEFAULT_BLOCK_ORDER.indexOf(id);
    let insertAfterIndex = -1;
    for (let i = defaultIndex - 1; i >= 0; i--) {
      const idx = result.findIndex(b => b.id === DEFAULT_BLOCK_ORDER[i]);
      if (idx !== -1) {
        insertAfterIndex = idx;
        break;
      }
    }
    const entry = { id, enabled: true };
    result =
      insertAfterIndex === -1
        ? [entry, ...result]
        : [...result.slice(0, insertAfterIndex + 1), entry, ...result.slice(insertAfterIndex + 1)];
  }
  return result;
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
    groups.set(it.libraryName, [...(groups.get(it.libraryName) ?? []), it]);
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
