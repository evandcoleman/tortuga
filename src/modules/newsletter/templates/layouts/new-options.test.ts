import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { createElement } from 'react';
import { resolveLayout, LAYOUT_OPTIONS } from './index';
import { resolveTheme, THEME_OPTIONS } from '../themes';
import type { EnrichedItem } from '../../types';

const NEW_LAYOUT_IDS = ['spotlight', 'timeline', 'ledger', 'index-toc'];
const NEW_THEME_IDS = ['cinema-noir', 'nocturne', 'atelier', 'travertine'];

const items: EnrichedItem[] = [
  {
    guid: 'g1',
    libraryName: 'Movies',
    title: 'The First Feature',
    mediaType: 'movie',
    addedAt: new Date('2026-05-01T00:00:00Z'),
    overview: 'o'.repeat(400),
    rating: 8.1,
    year: 2026,
    posterUrl: 'http://x/p.jpg',
    plexUrl: 'http://plex/open',
  },
  {
    guid: 'g2',
    libraryName: 'TV Shows',
    title: 'An Episode',
    mediaType: 'episode',
    addedAt: new Date('2026-05-02T00:00:00Z'),
    overview: 'second overview text',
    rating: 0,
    showTitle: 'A Great Show',
    seasonNumber: 2,
    episodeNumber: 5,
    // No posterUrl and no plexUrl: exercises placeholder + missing-link paths.
    posterUrl: null,
  },
];

describe('new layouts x new themes render', () => {
  for (const layoutId of NEW_LAYOUT_IDS) {
    for (const themeId of NEW_THEME_IDS) {
      it(`renders ${layoutId} with ${themeId} without throwing`, async () => {
        const layout = resolveLayout(layoutId);
        const theme = resolveTheme(themeId);
        expect(layout.id).toBe(layoutId);
        expect(theme.id).toBe(themeId);

        const html = await render(createElement(layout.Items, { items, theme }));
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('registry options include new ids', () => {
  it('LAYOUT_OPTIONS includes every new layout id', () => {
    const values = LAYOUT_OPTIONS.map(o => o.value);
    for (const id of NEW_LAYOUT_IDS) {
      expect(values).toContain(id);
    }
  });

  it('THEME_OPTIONS includes every new theme id', () => {
    const values = THEME_OPTIONS.map(o => o.value);
    for (const id of NEW_THEME_IDS) {
      expect(values).toContain(id);
    }
  });
});
