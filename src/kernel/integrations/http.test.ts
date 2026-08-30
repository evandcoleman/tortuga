import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry } from './http';

describe('fetchWithRetry', () => {
  it('returns response on first success', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('http://x', {}, { fetcher, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 then succeeds', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('e', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('http://x', {}, { fetcher, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));
    const res = await fetchWithRetry('http://x', {}, { fetcher, retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects when the provided signal aborts', async () => {
    const fetcher = vi.fn().mockImplementation((_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted.')));
      }),
    );
    const controller = new AbortController();
    const promise = fetchWithRetry('http://x', {}, { fetcher, retries: 2, baseDelayMs: 1, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow();
  });
});
