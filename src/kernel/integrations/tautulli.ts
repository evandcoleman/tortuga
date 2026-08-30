import { TautulliError } from './errors';
import { fetchWithRetry } from './http';

export interface TautulliOpts {
  url: string;
  apiKey: string;
  fetcher?: typeof fetch;
}
export interface TautulliUser {
  plexUserId: number;
  name: string;
  plexUsername: string | null;
  email: string | null;
}
export interface TautulliItem {
  guid: string;
  title: string;
  mediaType: string;
  libraryName: string;
  addedAt: Date;
  parentTitle?: string;
  grandparentTitle?: string;
  year?: number;
  summary?: string;
  thumb?: string;
  leavesAt?: Date;
  raw: Record<string, unknown>;
}

function mapTautulliItem(it: Record<string, unknown>): TautulliItem {
  return {
    guid: String(it.guid ?? it.rating_key),
    title: String(it.title ?? ''),
    mediaType: String(it.media_type ?? ''),
    libraryName: String(it.library_name ?? ''),
    addedAt: new Date(Number(it.added_at) * 1000),
    parentTitle: typeof it.parent_title === 'string' ? it.parent_title : undefined,
    grandparentTitle: typeof it.grandparent_title === 'string' ? it.grandparent_title : undefined,
    year: it.year ? Number(it.year) : undefined,
    summary: typeof it.summary === 'string' ? it.summary : undefined,
    thumb: typeof it.thumb === 'string' ? it.thumb : undefined,
    raw: it,
  };
}

export function createTautulliClient(opts: TautulliOpts) {
  async function call<T>(cmd: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL('/api/v2', opts.url);
    url.searchParams.set('apikey', opts.apiKey);
    url.searchParams.set('cmd', cmd);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetchWithRetry(url.toString(), { method: 'GET' }, { fetcher: opts.fetcher });
    if (!res.ok) throw new TautulliError(`HTTP ${res.status}`, res.status, res.status >= 500);
    const json = (await res.json()) as { response: { result: string; message?: string; data: T } };
    if (json.response.result !== 'success') throw new TautulliError(json.response.message ?? 'unknown error');
    return json.response.data;
  }

  return {
    async getUsers(): Promise<TautulliUser[]> {
      const raw = await call<Array<{ user_id: number; friendly_name?: string; username?: string; email?: string | null }>>('get_users');
      return raw.map(r => ({
        plexUserId: r.user_id,
        name: r.friendly_name ?? r.username ?? 'Unknown',
        plexUsername: r.username ?? null,
        email: r.email ?? null,
      }));
    },

    async getRecentlyAdded(args: { since: Date; count?: number }): Promise<TautulliItem[]> {
      const data = await call<{ recently_added: Array<Record<string, unknown>> }>('get_recently_added', { count: args.count ?? 200 });
      const cutoff = Math.floor(args.since.getTime() / 1000);
      return (data.recently_added ?? [])
        .filter(it => Number(it.added_at) >= cutoff)
        .map(mapTautulliItem);
    },

    async getMetadata(ratingKey: string): Promise<TautulliItem> {
      const data = await call<Record<string, unknown>>('get_metadata', { rating_key: ratingKey });
      return mapTautulliItem(data);
    },
  };
}

export type TautulliClient = ReturnType<typeof createTautulliClient>;
