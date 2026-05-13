export interface RetryOpts {
  retries?: number;
  baseDelayMs?: number;
  fetcher?: typeof fetch;
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
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await f(url, init);
      if (res.status < 500 && res.status !== 0) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt === retries) break;
    await sleep(base * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}
