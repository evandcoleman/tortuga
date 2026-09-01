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

  it('permanently redirects old /newsletter/recipients and /messages/invites paths to /people/*', async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/newsletter/recipients',
          destination: '/people/recipients',
          permanent: true,
        }),
        expect.objectContaining({
          source: '/messages/invites',
          destination: '/people/invites',
          permanent: true,
        }),
      ])
    );
  });

  it('permanently redirects the old /settings/portal tab to its own top-level /portal-settings page', async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/settings/portal',
          destination: '/portal-settings',
          permanent: true,
        }),
      ])
    );
  });
});
