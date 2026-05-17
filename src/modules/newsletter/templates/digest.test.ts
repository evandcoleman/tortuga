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
  const baseProps = {
    items,
    unsubscribeUrl: 'https://x/u',
    appName: 'Tortuga',
    windowStart: new Date('2026-05-01T00:00:00Z'),
    windowEnd: new Date('2026-05-08T00:00:00Z'),
  };

  it('renders subject + sections', async () => {
    const html = await render(DigestEmail(baseProps));
    expect(html).toContain('A Movie');
    expect(html).toContain('Movies');
    expect(html).toContain('Unsubscribe');
  });

  it('renders Open in Plex when plexUrl present', async () => {
    const html = await render(
      DigestEmail({
        ...baseProps,
        items: [
          { ...items[0], plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=x' },
        ],
      }),
    );
    expect(html).toContain('Open in Plex');
    expect(html).toContain('https://app.plex.tv/desktop/');
  });

  it('omits Open in Plex when plexUrl missing', async () => {
    const html = await render(DigestEmail(baseProps));
    expect(html).not.toContain('Open in Plex');
  });
});
