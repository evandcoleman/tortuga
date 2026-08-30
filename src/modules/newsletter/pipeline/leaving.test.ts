import { describe, it, expect, vi } from 'vitest';
import {
  fetchLeavingItems,
  computeLeavesAt,
  isCollectionEligible,
  isWithinLeavingWindow,
  dedupeByMediaServerId,
} from './leaving';
import type { MaintainerrCollection } from '@/kernel/integrations/maintainerr';

function fakeLog() {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any;
}

describe('computeLeavesAt', () => {
  it('adds deleteAfterDays days to addDate', () => {
    const leavesAt = computeLeavesAt('2026-10-25T12:00:00.000Z', 7);
    expect(leavesAt.toISOString()).toBe('2026-11-01T12:00:00.000Z');
  });

  it('is correct across the America/New_York DST fall-back boundary (Nov 1 2026)', () => {
    // DST ends 2026-11-01 in America/New_York. Adding calendar days should still
    // land on the same wall-clock date/time in UTC arithmetic (24h * N), which is
    // the deliberate, simple behaviour: deleteAfterDays is a fixed day count, not
    // a timezone-aware calendar addition.
    const addDate = '2026-10-28T04:00:00.000Z';
    const leavesAt = computeLeavesAt(addDate, 5);
    const expected = new Date(new Date(addDate).getTime() + 5 * 86_400_000);
    expect(leavesAt.getTime()).toBe(expected.getTime());
  });
});

describe('isCollectionEligible', () => {
  const base: MaintainerrCollection = {
    id: 1, title: 'C', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie',
  };

  it('accepts a collection with a positive deleteAfterDays and no exclusion', () => {
    expect(isCollectionEligible(base, [])).toBe(true);
  });

  it('rejects a null deleteAfterDays', () => {
    expect(isCollectionEligible({ ...base, deleteAfterDays: null }, [])).toBe(false);
  });

  it('rejects a zero or negative deleteAfterDays', () => {
    expect(isCollectionEligible({ ...base, deleteAfterDays: 0 }, [])).toBe(false);
    expect(isCollectionEligible({ ...base, deleteAfterDays: -1 }, [])).toBe(false);
  });

  it('rejects an excluded collection id', () => {
    expect(isCollectionEligible(base, [1])).toBe(false);
  });
});

describe('isWithinLeavingWindow', () => {
  const windowEnd = new Date('2026-10-25T12:00:00.000Z');

  it('excludes a leavesAt equal to windowEnd (exclusive lower bound)', () => {
    expect(isWithinLeavingWindow(windowEnd, windowEnd, 7)).toBe(false);
  });

  it('excludes a leavesAt before windowEnd', () => {
    const before = new Date(windowEnd.getTime() - 1000);
    expect(isWithinLeavingWindow(before, windowEnd, 7)).toBe(false);
  });

  it('includes a leavesAt exactly at windowEnd + days (inclusive upper bound)', () => {
    const upper = new Date(windowEnd.getTime() + 7 * 86_400_000);
    expect(isWithinLeavingWindow(upper, windowEnd, 7)).toBe(true);
  });

  it('excludes a leavesAt just after windowEnd + days', () => {
    const justAfter = new Date(windowEnd.getTime() + 7 * 86_400_000 + 1000);
    expect(isWithinLeavingWindow(justAfter, windowEnd, 7)).toBe(false);
  });

  it('includes a leavesAt strictly inside the window', () => {
    const inside = new Date(windowEnd.getTime() + 3 * 86_400_000);
    expect(isWithinLeavingWindow(inside, windowEnd, 7)).toBe(true);
  });
});

describe('dedupeByMediaServerId', () => {
  it('keeps the entry with the earliest leavesAt per mediaServerId', () => {
    const entries = [
      { mediaServerId: 'a', leavesAt: new Date('2026-11-05T00:00:00Z') },
      { mediaServerId: 'a', leavesAt: new Date('2026-11-01T00:00:00Z') },
      { mediaServerId: 'b', leavesAt: new Date('2026-11-03T00:00:00Z') },
    ];
    const out = dedupeByMediaServerId(entries);
    expect(out).toHaveLength(2);
    expect(out.find(e => e.mediaServerId === 'a')?.leavesAt.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('fetchLeavingItems', () => {
  const windowEnd = new Date('2026-10-25T00:00:00.000Z');

  function fakeDeps(overrides: Partial<{
    collections: any[];
    media: Record<number, any[]>;
    metadata: Record<string, any>;
  }> = {}) {
    const collections = overrides.collections ?? [
      { id: 1, title: 'Leaving', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie' },
    ];
    const mediaByCollection = overrides.media ?? {
      1: [{ id: 100, mediaServerId: 'rk1', addDate: '2026-10-20T00:00:00.000Z' }],
    };
    const metadataByRatingKey: Record<string, any> = overrides.metadata ?? {
      rk1: { guid: 'g1', title: 'Movie', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), raw: {} },
    };
    const maintainerr = {
      getCollections: vi.fn().mockResolvedValue(collections),
      getCollectionMedia: vi.fn().mockImplementation(async (id: number) => mediaByCollection[id] ?? []),
    };
    const tautulli = {
      getMetadata: vi.fn().mockImplementation(async (ratingKey: string) => {
        const found = metadataByRatingKey[ratingKey];
        if (!found) throw new Error(`not found: ${ratingKey}`);
        return found;
      }),
    };
    return { maintainerr, tautulli, log: fakeLog() };
  }

  it('returns items with leavesAt sorted ascending', async () => {
    const deps = fakeDeps({
      collections: [{ id: 1, title: 'L', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie' }],
      media: {
        1: [
          { id: 1, mediaServerId: 'rk1', addDate: '2026-10-22T00:00:00.000Z' },
          { id: 2, mediaServerId: 'rk2', addDate: '2026-10-19T00:00:00.000Z' },
        ],
      },
      metadata: {
        rk1: { guid: 'g1', title: 'A', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), raw: {} },
        rk2: { guid: 'g2', title: 'B', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), raw: {} },
      },
    });
    const out = await fetchLeavingItems(deps as any, { windowEnd, days: 7, excludedCollectionIds: [] });
    expect(out.map(i => i.guid)).toEqual(['g2', 'g1']);
    expect(out[0].leavesAt?.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });

  it('skips excluded and null-deleteAfterDays collections', async () => {
    const deps = fakeDeps({
      collections: [
        { id: 1, title: 'Excluded', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie' },
        { id: 2, title: 'NoTTL', deleteAfterDays: null, manualCollection: true, libraryId: 1, type: 'movie' },
      ],
      media: {
        1: [{ id: 1, mediaServerId: 'rk1', addDate: '2026-10-20T00:00:00.000Z' }],
        2: [{ id: 2, mediaServerId: 'rk2', addDate: '2026-10-20T00:00:00.000Z' }],
      },
    });
    const out = await fetchLeavingItems(deps as any, { windowEnd, days: 7, excludedCollectionIds: [1] });
    expect(out).toEqual([]);
    expect(deps.maintainerr.getCollectionMedia).not.toHaveBeenCalled();
  });

  it('dedupes by mediaServerId keeping the earliest leavesAt', async () => {
    const deps = fakeDeps({
      collections: [
        { id: 1, title: 'A', deleteAfterDays: 5, manualCollection: true, libraryId: 1, type: 'movie' },
        { id: 2, title: 'B', deleteAfterDays: 10, manualCollection: true, libraryId: 1, type: 'movie' },
      ],
      media: {
        1: [{ id: 1, mediaServerId: 'rk1', addDate: '2026-10-22T00:00:00.000Z' }],
        2: [{ id: 2, mediaServerId: 'rk1', addDate: '2026-10-16T00:00:00.000Z' }],
      },
    });
    const out = await fetchLeavingItems(deps as any, { windowEnd, days: 30, excludedCollectionIds: [] });
    expect(out).toHaveLength(1);
    expect(out[0].leavesAt?.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });

  it('drops an item whose metadata lookup fails, keeping the rest', async () => {
    const deps = fakeDeps({
      collections: [{ id: 1, title: 'L', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie' }],
      media: {
        1: [
          { id: 1, mediaServerId: 'rk1', addDate: '2026-10-20T00:00:00.000Z' },
          { id: 2, mediaServerId: 'missing', addDate: '2026-10-20T00:00:00.000Z' },
        ],
      },
      metadata: {
        rk1: { guid: 'g1', title: 'A', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), raw: {} },
      },
    });
    const out = await fetchLeavingItems(deps as any, { windowEnd, days: 7, excludedCollectionIds: [] });
    expect(out.map(i => i.guid)).toEqual(['g1']);
    expect(deps.log.warn).toHaveBeenCalled();
  });

  it('filters out items outside the window', async () => {
    const deps = fakeDeps({
      collections: [{ id: 1, title: 'L', deleteAfterDays: 1, manualCollection: true, libraryId: 1, type: 'movie' }],
      media: { 1: [{ id: 1, mediaServerId: 'rk1', addDate: '2026-10-01T00:00:00.000Z' }] },
    });
    const out = await fetchLeavingItems(deps as any, { windowEnd, days: 7, excludedCollectionIds: [] });
    expect(out).toEqual([]);
  });

  it('passes the signal through to every maintainerr call', async () => {
    const deps = fakeDeps({
      collections: [{ id: 1, title: 'L', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie' }],
      media: { 1: [{ id: 1, mediaServerId: 'rk1', addDate: '2026-10-20T00:00:00.000Z' }] },
    });
    const signal = new AbortController().signal;
    await fetchLeavingItems(deps as any, { windowEnd, days: 7, excludedCollectionIds: [], signal });
    expect(deps.maintainerr.getCollections).toHaveBeenCalledWith(signal);
    expect(deps.maintainerr.getCollectionMedia).toHaveBeenCalledWith(1, signal);
  });

  it('rejects when an already-aborted signal is supplied', async () => {
    const maintainerr = {
      getCollections: vi.fn().mockImplementation((signal?: AbortSignal) =>
        signal?.aborted ? Promise.reject(new Error('aborted')) : Promise.resolve([]),
      ),
      getCollectionMedia: vi.fn().mockResolvedValue([]),
    };
    const deps = { maintainerr, tautulli: { getMetadata: vi.fn() }, log: fakeLog() };
    await expect(
      fetchLeavingItems(deps as any, { windowEnd, days: 7, excludedCollectionIds: [], signal: AbortSignal.abort() }),
    ).rejects.toThrow('aborted');
  });
});
