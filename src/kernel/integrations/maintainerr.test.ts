import { describe, it, expect, vi } from 'vitest';
import { createMaintainerrClient } from './maintainerr';
import { MaintainerrError } from './errors';

const baseOpts = { url: 'http://maintainerr.local:6246' };

describe('MaintainerrClient', () => {
  it('parses the collections fixture', async () => {
    const fixture = [
      {
        id: 1, title: 'Leaving Orpheus (TV)', deleteAfterDays: 30,
        manualCollection: false, libraryId: '2', type: 'show',
      },
      {
        id: 2, title: 'Kept forever', deleteAfterDays: null,
        manualCollection: false, libraryId: '2', type: 'show',
      },
    ];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    const collections = await client.getCollections();
    expect(collections).toEqual([
      { id: 1, title: 'Leaving Orpheus (TV)', deleteAfterDays: 30 },
      { id: 2, title: 'Kept forever', deleteAfterDays: null },
    ]);
    expect(fetcher).toHaveBeenCalledWith('http://maintainerr.local:6246/api/collections', expect.anything());
  });

  it('accepts extra/unknown keys and a null tmdbId, ignoring the unknown keys', async () => {
    const fixture = [
      {
        id: 774, mediaServerId: '225221', plexId: null, tmdbId: null,
        addDate: '2026-08-07T04:00:00.000Z', isManual: false,
      },
    ];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    const media = await client.getCollectionMedia(1);
    expect(media).toEqual([
      { mediaServerId: '225221', tmdbId: null, addDate: '2026-08-07T04:00:00.000Z' },
    ]);
  });

  it('parses the collection media fixture', async () => {
    const fixture = [
      { mediaServerId: '12345', tmdbId: 603, addDate: '2026-10-01T00:00:00.000Z' },
      { mediaServerId: '67890', addDate: '2026-10-02T00:00:00.000Z' },
    ];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    const media = await client.getCollectionMedia(1);
    expect(media).toEqual(fixture);
    expect(fetcher).toHaveBeenCalledWith(
      'http://maintainerr.local:6246/api/collections/media?collectionId=1',
      expect.anything(),
    );
  });

  it('throws MaintainerrError on non-2xx response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('nope', { status: 503 }));
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    await expect(client.getCollections()).rejects.toThrow(/503/);
  });

  it('throws MaintainerrError on invalid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    await expect(client.getCollections()).rejects.toThrow();
  });

  it('rejects with MaintainerrError when the collections body does not conform to the schema', async () => {
    const malformed = [{ id: 'not-a-number', title: 'X' }];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(malformed), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    await expect(client.getCollections()).rejects.toThrow(MaintainerrError);
  });

  it('rejects with MaintainerrError when the media body does not conform to the schema', async () => {
    const malformed = [{ mediaServerId: 12345, addDate: '2026-10-01T00:00:00.000Z' }];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(malformed), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    await expect(client.getCollectionMedia(1)).rejects.toThrow(MaintainerrError);
  });

  it('rejects when the passed signal is already aborted', async () => {
    const fetcher = vi.fn().mockImplementation((_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        if (init.signal?.aborted) {
          reject(new Error('The operation was aborted.'));
          return;
        }
        init.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted.')));
      }),
    );
    const client = createMaintainerrClient({ ...baseOpts, fetcher });
    await expect(client.getCollections(AbortSignal.abort())).rejects.toThrow();
  });

  it('normalises a trailing slash on the base url', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = createMaintainerrClient({ url: 'http://maintainerr.local:6246/', fetcher });
    await client.getCollections();
    expect(fetcher).toHaveBeenCalledWith('http://maintainerr.local:6246/api/collections', expect.anything());
  });
});
