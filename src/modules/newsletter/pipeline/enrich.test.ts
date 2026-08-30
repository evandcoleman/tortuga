import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
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

  it('captures episodeNumber from media_index for episodes', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const epItem: TautulliItem = {
      guid: 'ep1', title: 'Ep', mediaType: 'episode', libraryName: 'TV',
      addedAt: new Date(), grandparentTitle: 'Show',
      raw: { parent_media_index: '2', media_index: '5' },
    };
    const out = await enrichItems(db, fakeTmdb as any, [epItem]);
    expect(out[0].seasonNumber).toBe(2);
    expect(out[0].episodeNumber).toBe(5);
  });

  it('backfills episodeNumber on a cache hit', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const epItem: TautulliItem = {
      guid: 'ep2', title: 'Ep', mediaType: 'episode', libraryName: 'TV',
      addedAt: new Date(), grandparentTitle: 'Show',
      raw: { parent_media_index: '1', media_index: '9' },
    };
    const { episodeNumber: _drop, ...stale } = (await enrichItems(db, fakeTmdb as any, [epItem]))[0];
    db.update(itemsCache).set({ payload: JSON.stringify(stale) }).where(eq(itemsCache.guid, 'ep2')).run();
    const out = await enrichItems(db, fakeTmdb as any, [epItem]);
    expect(out[0].episodeNumber).toBe(9);
  });

  it('carries leavesAt through on a fresh enrich', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const leavesAt = new Date('2026-11-01T12:00:00Z');
    const out = await enrichItems(db, fakeTmdb as any, [{ ...item, guid: 'leaving1', leavesAt }]);
    expect(out[0].leavesAt).toEqual(leavesAt);
  });

  it('cache hit without leavesAt on the request yields undefined, even if a prior cached payload had one', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const firstLeavesAt = new Date('2026-11-01T12:00:00Z');
    await enrichItems(db, fakeTmdb as any, [{ ...item, guid: 'leaving2', leavesAt: firstLeavesAt }]);
    const out = await enrichItems(db, fakeTmdb as any, [{ ...item, guid: 'leaving2' }]);
    expect(out[0].leavesAt).toBeUndefined();
  });

  it('cache hit with leavesAt on the request uses the request value (request is source of truth)', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const firstLeavesAt = new Date('2026-11-01T12:00:00Z');
    await enrichItems(db, fakeTmdb as any, [{ ...item, guid: 'leaving3', leavesAt: firstLeavesAt }]);
    const secondLeavesAt = new Date('2026-11-05T12:00:00Z');
    const out = await enrichItems(db, fakeTmdb as any, [{ ...item, guid: 'leaving3', leavesAt: secondLeavesAt }]);
    expect(out[0].leavesAt).toEqual(secondLeavesAt);
  });

  it('never persists leavesAt into the cache payload', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const leavesAt = new Date('2026-11-01T12:00:00Z');
    await enrichItems(db, fakeTmdb as any, [{ ...item, guid: 'leaving4', leavesAt }]);
    const [cached] = db.select().from(itemsCache).where(eq(itemsCache.guid, 'leaving4')).all();
    const payload = JSON.parse(cached.payload);
    expect(payload).not.toHaveProperty('leavesAt');
  });
});
