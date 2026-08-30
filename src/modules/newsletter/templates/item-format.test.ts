import { describe, it, expect } from 'vitest';
import { formatEpisodeRange, itemKicker, leavesLabel } from './item-format';
import type { EnrichedItem } from '../types';

describe('itemKicker leaves option', () => {
  const leavingItem: EnrichedItem = {
    guid: 'x', title: 'X', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(),
    rating: 0, posterUrl: null, overview: '', leavesAt: new Date('2026-09-06T12:00:00Z'), year: 2020,
  };

  it('includes the Leaves label by default', () => {
    expect(itemKicker(leavingItem, 'UTC')).toContain('Leaves');
  });

  it('omits the Leaves label when includeLeaves is false', () => {
    const kicker = itemKicker(leavingItem, 'UTC', { includeLeaves: false });
    expect(kicker).not.toContain('Leaves');
    expect(kicker).toContain('Film');
  });
});

describe('leavesLabel', () => {
  it('formats a date using the given IANA timezone', () => {
    const date = new Date('2026-09-06T12:00:00Z');
    expect(leavesLabel(date, 'UTC')).toBe('Leaves Sun, Sep 6');
  });

  it('falls back to formatting without a timeZone when the timezone is invalid', () => {
    const date = new Date('2026-09-06T12:00:00Z');
    expect(() => leavesLabel(date, 'Not/AZone')).not.toThrow();
    expect(leavesLabel(date, 'Not/AZone')).toBe(leavesLabel(date, undefined));
  });
});

describe('formatEpisodeRange', () => {
  it('formats a single number', () => {
    expect(formatEpisodeRange([5])).toBe('5');
  });
  it('collapses a consecutive run with an en dash', () => {
    expect(formatEpisodeRange([5, 6, 7])).toBe('5–7');
  });
  it('lists non-consecutive numbers comma-separated', () => {
    expect(formatEpisodeRange([2, 5, 8])).toBe('2, 5, 8');
  });
  it('mixes runs and singletons', () => {
    expect(formatEpisodeRange([1, 2, 3, 7])).toBe('1–3, 7');
  });
  it('handles multiple runs', () => {
    expect(formatEpisodeRange([1, 2, 4, 5])).toBe('1–2, 4–5');
  });
});

const ep = (over: Partial<EnrichedItem>): EnrichedItem => ({
  guid: 'g', title: 't', mediaType: 'movie', libraryName: 'TV',
  addedAt: new Date(), rating: 7, posterUrl: null, overview: '',
  ...over,
});

describe('itemKicker episode handling', () => {
  it('shows a consecutive episode range on a fully-numbered season', () => {
    expect(itemKicker(ep({ mediaType: 'season', seasonNumber: 2, episodeCount: 3, episodeNumbers: [5, 6, 7] }))).toBe('Season 2 · Episodes 5–7');
  });
  it('shows E-prefixed list for non-consecutive season episodes', () => {
    expect(itemKicker(ep({ mediaType: 'season', seasonNumber: 3, episodeCount: 3, episodeNumbers: [2, 5, 8] }))).toBe('Season 3 · E2, E5, E8');
  });
  it('falls back to the count when some episodes lack a number', () => {
    expect(itemKicker(ep({ mediaType: 'season', seasonNumber: 2, episodeCount: 3, episodeNumbers: [5, 6] }))).toBe('Season 2 · 3 new episodes');
  });
  it('falls back to the count when no episode numbers exist', () => {
    expect(itemKicker(ep({ mediaType: 'season', seasonNumber: 1, episodeCount: 2 }))).toBe('Season 1 · 2 new episodes');
  });
  it('shows season and episode number on a single episode', () => {
    expect(itemKicker(ep({ mediaType: 'episode', seasonNumber: 2, episodeNumber: 5 }))).toBe('Series · Season 2 · E5');
  });
  it('still labels a movie', () => {
    expect(itemKicker(ep({ mediaType: 'movie', year: 2024 }))).toBe('Film · 2024');
  });
  it('renders mixed runs as an E-prefixed list, not a dash range', () => {
    expect(itemKicker(ep({ mediaType: 'season', seasonNumber: 1, episodeCount: 4, episodeNumbers: [1, 2, 4, 5] }))).toBe('Season 1 · E1, E2, E4, E5');
  });
});
