import { describe, it, expect, vi } from 'vitest';
import { createTmdbClient } from './tmdb';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('TmdbClient', () => {
  it('searchMovie returns first match', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({
      results: [{ id: 1, title: 'X', vote_average: 7.5, poster_path: '/p.jpg', overview: 'o' }],
    }));
    const c = createTmdbClient({ apiKey: 'k', fetcher });
    const r = await c.searchMovie({ title: 'X', year: 2020 });
    expect(r).toMatchObject({ id: 1, rating: 7.5, posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg' });
  });

  it('searchMovie returns null on empty', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ results: [] }));
    const c = createTmdbClient({ apiKey: 'k', fetcher });
    expect(await c.searchMovie({ title: 'Y' })).toBeNull();
  });
});
