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

  it('throws TautulliError on API error response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { result: 'error', message: 'bad key' } }), { status: 200 }),
    );
    const client = createTautulliClient({ ...baseOpts, fetcher });
    await expect(client.getUsers()).rejects.toThrow(/bad key/);
  });
});
