import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { enrichItems } from './enrich';
import type { TautulliItem } from '@/kernel/integrations/tautulli';
import { itemsCache } from '../schema';

const fakeTmdb = {
  searchMovie: vi.fn().mockImplementation(async ({ title }) => ({
    id: 1, title, rating: 7, posterUrl: 'http://p/x.jpg', overview: 'o',
  })),
  searchTv: vi.fn().mockResolvedValue({ id: 2, title: 'show', rating: 8, posterUrl: null, overview: 'o' }),
};

const item: TautulliItem = {
  guid: 'g1', title: 'M', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date(), year: 2020, raw: {},
};

describe('enrichItems', () => {
  it('queries TMDB for movies, caches results', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const out = await enrichItems(db, fakeTmdb as any, [item]);
    expect(out[0].rating).toBe(7);
    expect(db.select().from(itemsCache).all()).toHaveLength(1);
  });

  it('uses cache on second call', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await enrichItems(db, fakeTmdb as any, [item]);
    const callsBefore = fakeTmdb.searchMovie.mock.calls.length;
    await enrichItems(db, fakeTmdb as any, [item]);
    expect(fakeTmdb.searchMovie.mock.calls.length).toBe(callsBefore);
  });

  it('returns addedAt as a Date on a cache hit (not the stringified JSON value)', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await enrichItems(db, fakeTmdb as any, [item]);
    const [cachedItem] = await enrichItems(db, fakeTmdb as any, [item]);
    expect(cachedItem.addedAt).toBeInstanceOf(Date);
    expect(() => cachedItem.addedAt.getTime()).not.toThrow();
  });
});
