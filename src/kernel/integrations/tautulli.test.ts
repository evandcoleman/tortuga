import { describe, it, expect, vi } from 'vitest';
import { createTautulliClient } from './tautulli';

const baseOpts = { url: 'http://t.local:8181', apiKey: 'k' };
const ok = (body: unknown) =>
  new Response(JSON.stringify({ response: { result: 'success', data: body } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });

describe('TautulliClient', () => {
  it('getUsers returns normalized users', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([
      { user_id: 1, friendly_name: 'A', email: 'a@x.io', username: 'a' },
      { user_id: 2, friendly_name: 'B', email: null, username: 'b' },
    ]));
    const client = createTautulliClient({ ...baseOpts, fetcher });
    const users = await client.getUsers();
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ email: 'a@x.io', name: 'A', plexUsername: 'a' });
    expect(users[1].email).toBeNull();
  });

  it('getRecentlyAdded filters by since', async () => {
    const now = Date.now();
    const items = [
      { added_at: String(Math.floor(now / 1000) - 60), guid: 'g1', title: 'T1', media_type: 'movie', library_name: 'Movies' },
      { added_at: String(Math.floor(now / 1000) - 86400 * 30), guid: 'g2', title: 'T2', media_type: 'movie', library_name: 'Movies' },
    ];
    const fetcher = vi.fn().mockResolvedValue(ok({ recently_added: items }));
    const client = createTautulliClient({ ...baseOpts, fetcher });
    const since = new Date(now - 7 * 86_400_000);
    const result = await client.getRecentlyAdded({ since, count: 200 });
    expect(result.map(i => i.guid)).toEqual(['g1']);
  });

  it('getMetadata maps a movie fixture to a TautulliItem', async () => {
    const fixture = {
      rating_key: '555', guid: 'plex://movie/555', title: 'Some Movie', media_type: 'movie',
      library_name: 'Movies', added_at: '1700000000', year: 2021, summary: 'A movie.', thumb: '/thumb/555',
    };
    const fetcher = vi.fn().mockResolvedValue(ok(fixture));
    const client = createTautulliClient({ ...baseOpts, fetcher });
    const item = await client.getMetadata('555');
    expect(item).toMatchObject({
      guid: 'plex://movie/555', title: 'Some Movie', mediaType: 'movie',
      libraryName: 'Movies', year: 2021, summary: 'A movie.', thumb: '/thumb/555',
    });
    expect(item.addedAt).toEqual(new Date(1700000000 * 1000));
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('cmd')).toBe('get_metadata');
    expect(url.searchParams.get('rating_key')).toBe('555');
  });

  it('getMetadata maps an episode fixture to a TautulliItem', async () => {
    const fixture = {
      rating_key: '999', guid: 'plex://episode/999', title: 'Pilot', media_type: 'episode',
      library_name: 'TV Shows', added_at: '1700000000',
      parent_title: 'Season 1', grandparent_title: 'Some Show',
    };
    const fetcher = vi.fn().mockResolvedValue(ok(fixture));
    const client = createTautulliClient({ ...baseOpts, fetcher });
    const item = await client.getMetadata('999');
    expect(item).toMatchObject({
      guid: 'plex://episode/999', title: 'Pilot', mediaType: 'episode',
      parentTitle: 'Season 1', grandparentTitle: 'Some Show',
    });
  });

  it('throws TautulliError on API error response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { result: 'error', message: 'bad key' } }), { status: 200 }),
    );
    const client = createTautulliClient({ ...baseOpts, fetcher });
    await expect(client.getUsers()).rejects.toThrow(/bad key/);
  });
});
