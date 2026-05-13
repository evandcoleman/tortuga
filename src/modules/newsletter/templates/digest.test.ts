import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { DigestEmail } from './digest';
import type { EnrichedItem } from '../types';

const items: EnrichedItem[] = [{
  guid: 'g1', title: 'A Movie', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date('2026-05-01T00:00:00Z'), rating: 7.4,
  posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg', overview: 'A summary',
}];

describe('DigestEmail', () => {
  it('renders subject + sections', async () => {
    const html = await render(DigestEmail({ items, unsubscribeUrl: 'https://x/u', appName: 'Tortuga' }));
    expect(html).toContain('A Movie');
    expect(html).toContain('Movies');
    expect(html).toContain('Unsubscribe');
  });
});
