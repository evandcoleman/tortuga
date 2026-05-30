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
