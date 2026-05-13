import type { EnrichedItem } from './types';

export interface FilterOpts {
  min_tmdb_rating: number;
  dedupe_episodes_into_seasons: boolean;
  max_items_per_section: number;
  exclude_genres: string[];
}

export function applyFilters(
  items: EnrichedItem[],
  opts: FilterOpts,
  includeLibraries?: string[] | null,
): EnrichedItem[] {
  const excludedGenres = new Set(opts.exclude_genres.map(g => g.toLowerCase()));
  let working = items
    .filter(i => i.rating >= opts.min_tmdb_rating)
    .filter(i => !includeLibraries?.length || includeLibraries.includes(i.libraryName))
    .filter(i => !i.genres || !i.genres.some(g => excludedGenres.has(g.toLowerCase())));

  if (opts.dedupe_episodes_into_seasons) {
    const rolledUp = new Map<string, EnrichedItem>();
    const kept: EnrichedItem[] = [];
    for (const item of working) {
      if (item.mediaType === 'episode' && item.showTitle && item.seasonNumber !== undefined) {
        const key = `${item.showTitle}::S${item.seasonNumber}::${item.libraryName}`;
        const existing = rolledUp.get(key);
        if (existing) {
          existing.episodeCount = (existing.episodeCount ?? 1) + 1;
          continue;
        }
        const season: EnrichedItem = {
          ...item,
          mediaType: 'season',
          title: `${item.showTitle} — Season ${item.seasonNumber}`,
          episodeCount: 1,
        };
        rolledUp.set(key, season);
        kept.push(season);
      } else {
        kept.push(item);
      }
    }
    working = kept;
  }

  const bySection = new Map<string, EnrichedItem[]>();
  for (const item of working) {
    const list = bySection.get(item.libraryName) ?? [];
    list.push(item);
    bySection.set(item.libraryName, list);
  }
  const capped: EnrichedItem[] = [];
  for (const [, list] of bySection) {
    list.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    capped.push(...list.slice(0, opts.max_items_per_section));
  }
  return capped;
}
