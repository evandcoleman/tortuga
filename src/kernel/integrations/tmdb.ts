import { TmdbError } from './errors';
import { fetchWithRetry } from './http';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

export interface TmdbOpts {
  apiKey: string;
  fetcher?: typeof fetch;
}
export interface TmdbItem {
  id: number;
  title: string;
  rating: number;
  posterUrl: string | null;
  overview: string;
}

export function createTmdbClient(opts: TmdbOpts) {
  async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('api_key', opts.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchWithRetry(url.toString(), {}, { fetcher: opts.fetcher });
    if (!res.ok) throw new TmdbError(`HTTP ${res.status}`, res.status, res.status >= 500);
    return res.json() as Promise<T>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function pickFirst(results: any[], type: 'movie' | 'tv'): TmdbItem | null {
    if (!results || results.length === 0) return null;
    const r = results[0];
    return {
      id: r.id,
      title: type === 'movie' ? (r.title ?? r.original_title) : (r.name ?? r.original_name),
      rating: typeof r.vote_average === 'number' ? r.vote_average : 0,
      posterUrl: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : null,
      overview: r.overview ?? '',
    };
  }

  return {
    async searchMovie(args: { title: string; year?: number }): Promise<TmdbItem | null> {
      const params: Record<string, string> = { query: args.title };
      if (args.year) params.year = String(args.year);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await call<{ results: any[] }>('/search/movie', params);
      return pickFirst(data.results, 'movie');
    },
    async searchTv(args: { title: string; firstAirYear?: number }): Promise<TmdbItem | null> {
      const params: Record<string, string> = { query: args.title };
      if (args.firstAirYear) params.first_air_date_year = String(args.firstAirYear);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await call<{ results: any[] }>('/search/tv', params);
      return pickFirst(data.results, 'tv');
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
