import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config.mjs';

describe('next.config redirects', () => {
  it('permanently redirects old /newsletter/messages paths to /messages', async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/newsletter/messages',
          destination: '/messages',
          permanent: true,
        }),
        expect.objectContaining({
          source: '/newsletter/messages/history',
          destination: '/messages/history',
          permanent: true,
        }),
        expect.objectContaining({
          source: '/newsletter/messages/history/:id',
          destination: '/messages/history/:id',
          permanent: true,
        }),
      ])
    );
  });
});
