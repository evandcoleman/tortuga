import { describe, it, expect } from 'vitest';
import { filterItemsByLibraries } from './library-filter';
import type { EnrichedItem } from '../types';

function item(libraryName: string, guid = libraryName): EnrichedItem {
  return {
    guid, title: guid, mediaType: 'movie', libraryName,
    addedAt: new Date('2026-05-01T00:00:00Z'), rating: 0,
    posterUrl: null, overview: '',
  };
}

describe('filterItemsByLibraries', () => {
  it('returns items unchanged when libraries is null (no filtering)', () => {
    const items = [item('Movies'), item('TV Shows')];
    expect(filterItemsByLibraries(items, null)).toEqual(items);
  });

  it('drops items whose library is not in the allowed list', () => {
    const movies = item('Movies');
    const tv = item('TV Shows');
    expect(filterItemsByLibraries([movies, tv], ['Movies'])).toEqual([movies]);
  });

  it('returns an empty array when the allowed list matches nothing', () => {
    const items = [item('Movies'), item('TV Shows')];
    expect(filterItemsByLibraries(items, ['Anime'])).toEqual([]);
  });

  it('returns an empty array unchanged for an empty items input', () => {
    expect(filterItemsByLibraries([], ['Movies'])).toEqual([]);
  });
});
