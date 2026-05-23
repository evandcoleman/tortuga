import { describe, it, expect } from 'vitest';
import { applyFilters } from './filters';
import type { EnrichedItem } from './types';

const base = (over: Partial<EnrichedItem>): EnrichedItem => ({
  guid: 'g', title: 't', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date(), rating: 7, posterUrl: null, overview: '',
  ...over,
});

describe('applyFilters', () => {
  it('drops items below min_tmdb_rating', () => {
    const items = [base({ guid: 'a', rating: 4 }), base({ guid: 'b', rating: 8 })];
    const out = applyFilters(items, { min_tmdb_rating: 6, dedupe_episodes_into_seasons: false, max_items_per_section: 99, exclude_genres: [] });
    expect(out.map(i => i.guid)).toEqual(['b']);
  });

  it('restricts to include_libraries', () => {
    const items = [base({ guid: 'a', libraryName: 'Movies' }), base({ guid: 'b', libraryName: 'Music' })];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: false, max_items_per_section: 99, exclude_genres: [] }, ['Movies']);
    expect(out.map(i => i.guid)).toEqual(['a']);
  });

  it('rolls episodes up to a season row with episode_count', () => {
    const items = [
      base({ guid: 'e1', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E1' }),
      base({ guid: 'e2', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E2' }),
      base({ guid: 'e3', mediaType: 'episode', showTitle: 'X', seasonNumber: 2, libraryName: 'TV Shows', title: 'E3' }),
    ];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 99, exclude_genres: [] });
    const tv = out.filter(i => i.libraryName === 'TV Shows');
    expect(tv).toHaveLength(2);
    expect(tv.find(i => i.seasonNumber === 1)?.episodeCount).toBe(2);
    expect(tv.find(i => i.seasonNumber === 2)?.episodeCount).toBe(1);
  });

  it('caps per-section count', () => {
    const items = Array.from({ length: 20 }, (_, i) => base({ guid: `g${i}` }));
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: false, max_items_per_section: 5, exclude_genres: [] });
    expect(out).toHaveLength(5);
  });

  it('drops excluded genres', () => {
    const items = [base({ guid: 'a', genres: ['Horror'] }), base({ guid: 'b', genres: ['Drama'] })];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: false, max_items_per_section: 99, exclude_genres: ['Horror'] });
    expect(out.map(i => i.guid)).toEqual(['b']);
  });

  it('accumulates sorted episodeNumbers during roll-up', () => {
    const items = [
      base({ guid: 'e2', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E2', episodeNumber: 7 }),
      base({ guid: 'e1', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E1', episodeNumber: 5 }),
      base({ guid: 'e3', mediaType: 'episode', showTitle: 'X', seasonNumber: 1, libraryName: 'TV Shows', title: 'E3', episodeNumber: 6 }),
    ];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 99, exclude_genres: [] });
    const season = out.find(i => i.seasonNumber === 1);
    expect(season?.episodeCount).toBe(3);
    expect(season?.episodeNumbers).toEqual([5, 6, 7]);
  });

  it('leaves episodeNumbers shorter than episodeCount when a number is missing', () => {
    const items = [
      base({ guid: 'e1', mediaType: 'episode', showTitle: 'Y', seasonNumber: 1, libraryName: 'TV Shows', title: 'E1', episodeNumber: 5 }),
      base({ guid: 'e2', mediaType: 'episode', showTitle: 'Y', seasonNumber: 1, libraryName: 'TV Shows', title: 'E2' }),
    ];
    const out = applyFilters(items, { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 99, exclude_genres: [] });
    const season = out.find(i => i.seasonNumber === 1);
    expect(season?.episodeCount).toBe(2);
    expect(season?.episodeNumbers).toEqual([5]);
  });
});
