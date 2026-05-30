import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { createElement } from 'react';
import { resolveLayout, DEFAULT_LAYOUT_ID, LAYOUT_OPTIONS, LAYOUTS } from './index';
import { resolveTheme } from '../themes';
import { ListItems } from './list';
import type { EnrichedItem } from '../../types';

const theme = resolveTheme('editorial');
const baseItem: EnrichedItem = {
  guid: 'g1', libraryName: 'Movies', title: 'X', mediaType: 'movie',
  addedAt: new Date('2026-05-01T00:00:00Z'),
  overview: 'o'.repeat(400), rating: 8.1, posterUrl: 'http://x/p.jpg',
};

describe('ListItems itemDisplay', () => {
  it('hides the poster when showPoster is false', async () => {
    const html = await render(createElement(ListItems, {
      items: [baseItem], theme,
      itemDisplay: { showPoster: false, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md' },
    }));
    expect(html).not.toContain('p.jpg');
  });
  it('omits overview text when showOverview is false', async () => {
    const html = await render(createElement(ListItems, {
      items: [baseItem], theme,
      itemDisplay: { showPoster: true, showRating: true, showOverview: false, overviewMaxChars: null, posterScale: 'md' },
    }));
    expect(html).not.toContain('oooo');
  });
});

describe('layout registry', () => {
  it('resolves a known id', () => {
    expect(resolveLayout('list').id).toBe('list');
  });

  it('falls back to default for unknown or blank id', () => {
    expect(resolveLayout('nope').id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout('').id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout(undefined).id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout(null).id).toBe(DEFAULT_LAYOUT_ID);
  });

  it('exposes options for every registered layout', () => {
    expect(LAYOUT_OPTIONS).toEqual(
      Object.values(LAYOUTS).map(l => ({ value: l.id, label: l.label })),
    );
  });
});
