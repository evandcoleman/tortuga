import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import type { TmdbClient } from '@/kernel/integrations/tmdb';
import type { TautulliItem } from '@/kernel/integrations/tautulli';
import { itemsCache } from '../schema';
import type { EnrichedItem } from '../types';

const CONCURRENCY = 5;

async function mapWithConcurrency<I, O>(items: I[], fn: (i: I) => Promise<O>, limit: number): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function enrichItems(db: Db, tmdb: TmdbClient, items: TautulliItem[]): Promise<EnrichedItem[]> {
  return mapWithConcurrency(items, async (item) => {
    const cached = db.select().from(itemsCache).where(eq(itemsCache.guid, item.guid)).all();
    if (cached.length > 0) {
      return JSON.parse(cached[0].payload) as EnrichedItem;
    }
    const isTv = item.mediaType === 'episode' || item.mediaType === 'season' || item.mediaType === 'show';
    const searchTitle = item.grandparentTitle ?? item.title;
    const tmdbRes = isTv
      ? await tmdb.searchTv({ title: searchTitle })
      : await tmdb.searchMovie({ title: item.title, year: item.year });

    const enriched: EnrichedItem = {
      guid: item.guid,
      title: item.title,
      mediaType: item.mediaType,
      libraryName: item.libraryName,
      addedAt: item.addedAt,
      year: item.year,
      rating: tmdbRes?.rating ?? 0,
      posterUrl: tmdbRes?.posterUrl ?? null,
      overview: tmdbRes?.overview ?? item.summary ?? '',
      showTitle: item.grandparentTitle,
      seasonNumber: typeof item.raw.parent_media_index === 'string' ? Number(item.raw.parent_media_index) : undefined,
    };
    db.insert(itemsCache).values({
      guid: item.guid,
      payload: JSON.stringify(enriched),
      addedAt: item.addedAt,
      cachedAt: new Date(),
    }).run();
    return enriched;
  }, CONCURRENCY);
}
