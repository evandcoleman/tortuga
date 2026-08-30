import { z } from 'zod';
import { MaintainerrError } from './errors';
import { fetchWithRetry } from './http';

export interface MaintainerrOpts {
  url: string;
  fetcher?: typeof fetch;
}

const collectionSchema = z.object({
  id: z.number(),
  title: z.string(),
  deleteAfterDays: z.number().nullable(),
});
const collectionsSchema = z.array(collectionSchema);
export type MaintainerrCollection = z.infer<typeof collectionSchema>;

const collectionMediaSchema = z.object({
  mediaServerId: z.string(),
  tmdbId: z.number().nullable().optional(),
  addDate: z.string(),
});
const collectionMediaListSchema = z.array(collectionMediaSchema);
export type MaintainerrCollectionMedia = z.infer<typeof collectionMediaSchema>;

export function createMaintainerrClient(opts: MaintainerrOpts) {
  const baseUrl = opts.url.replace(/\/+$/, '');

  async function call<T>(
    path: string,
    schema: z.ZodType<T>,
    params: Record<string, string | number> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetchWithRetry(url.toString(), { method: 'GET' }, { fetcher: opts.fetcher, signal });
    if (!res.ok) throw new MaintainerrError(`HTTP ${res.status}`, res.status, res.status >= 500);
    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      throw new MaintainerrError('invalid JSON response', res.status, false, err);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new MaintainerrError('response did not match the expected schema', res.status, false, parsed.error);
    }
    return parsed.data;
  }

  return {
    async getCollections(signal?: AbortSignal): Promise<MaintainerrCollection[]> {
      return call('/api/collections', collectionsSchema, {}, signal);
    },

    async getCollectionMedia(collectionId: number, signal?: AbortSignal): Promise<MaintainerrCollectionMedia[]> {
      return call('/api/collections/media', collectionMediaListSchema, { collectionId }, signal);
    },
  };
}

export type MaintainerrClient = ReturnType<typeof createMaintainerrClient>;
