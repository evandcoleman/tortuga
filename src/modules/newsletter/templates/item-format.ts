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
