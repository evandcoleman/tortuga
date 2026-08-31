/**
 * Default per-attempt timeout applied when the caller doesn't specify one.
 * Guards against a hung upstream blocking a scheduled handler indefinitely.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export interface RetryOpts {
  retries?: number;
  baseDelayMs?: number;
  fetcher?: typeof fetch;
  /** Aborts the request (and stops further retries) when the signal fires. */
  signal?: AbortSignal;
  /** Per-attempt timeout in ms. Defaults to {@link DEFAULT_FETCH_TIMEOUT_MS}. */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOpts = {},
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 200;
  const f = opts.fetcher ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;
    const requestInit = { ...init, signal };
    try {
      const res = await f(url, requestInit);
      if (res.status < 500 && res.status !== 0) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt === retries || opts.signal?.aborted) break;
    await sleep(base * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}
