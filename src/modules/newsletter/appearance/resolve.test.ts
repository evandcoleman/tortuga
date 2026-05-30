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
