import type { EnrichedItem } from '../types';

// Formats an item's Maintainerr removal date as "Leaves <weekday>, <Mon D>" in the
// given IANA timezone (falls back to the runtime default when omitted).
export function leavesLabel(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone }).format(date);
  } catch (err) {
    if (err instanceof RangeError) {
      // Invalid IANA timezone (e.g. bad config value slipped through) — fall
      // back to the runtime default rather than failing the whole digest.
      formatted = new Intl.DateTimeFormat('en-US', opts).format(date);
    } else {
      throw err;
    }
  }
  return `Leaves ${formatted}`;
}

export interface ItemKickerOptions {
  /** Set false when the caller renders the "Leaves …" label elsewhere (e.g. the timeline rail), to avoid printing it twice. */
  includeLeaves?: boolean;
}

export function itemKicker(item: EnrichedItem, timezone?: string, options?: ItemKickerOptions): string | null {
  const includeLeaves = options?.includeLeaves ?? true;
  const bits: string[] = [];
  if (includeLeaves && item.leavesAt) bits.push(leavesLabel(item.leavesAt, timezone));
  if (item.mediaType === 'movie') bits.push('Film');
  if (item.mediaType === 'show') bits.push('Series');

  if (item.mediaType === 'episode') {
    bits.push('Series');
    if (typeof item.seasonNumber === 'number') bits.push(`Season ${item.seasonNumber}`);
    if (typeof item.episodeNumber === 'number') bits.push(`E${item.episodeNumber}`);
  }

  if (item.mediaType === 'season' && typeof item.seasonNumber === 'number') {
    bits.push(`Season ${item.seasonNumber}`);
    const nums = item.episodeNumbers;
    if (nums && nums.length > 0 && nums.length === item.episodeCount) {
      const isConsecutiveRun = nums.length > 1 && nums[nums.length - 1] - nums[0] === nums.length - 1;
      bits.push(isConsecutiveRun ? `Episodes ${formatEpisodeRange(nums)}` : nums.map(n => `E${n}`).join(', '));
    } else if (item.episodeCount) {
      bits.push(`${item.episodeCount} new episode${item.episodeCount === 1 ? '' : 's'}`);
    }
  }

  if (item.year) bits.push(String(item.year));
  return bits.length > 0 ? bits.join(' · ') : null;
}

// Collapses a sorted, non-empty ascending list of episode numbers into a compact
// string: [5,6,7] -> "5–7"; [2,5,8] -> "2, 5, 8"; [1,2,3,7] -> "1–3, 7"; [5] -> "5".
export function formatEpisodeRange(nums: number[]): string {
  const runs: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    const n = nums[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  return runs.join(', ');
}

export function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function displayTitle(item: EnrichedItem): string {
  return item.mediaType === 'season' && item.showTitle ? item.showTitle : item.title;
}
