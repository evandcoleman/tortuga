import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeFailure,
  testTautulliConnection,
  testTmdbConnection,
  testResendConnection,
} from './connection-tests';

describe('sanitizeFailure', () => {
  it('reports auth failures for 401/403', () => {
    expect(sanitizeFailure({ status: 401 })).toMatch(/authentication failed/);
    expect(sanitizeFailure({ status: 403 })).toMatch(/authentication failed/);
  });

  it('reports a not-found hint for 404', () => {
    expect(sanitizeFailure({ status: 404 })).toMatch(/endpoint not found/);
  });

  it('reports a server-error hint for 5xx', () => {
    expect(sanitizeFailure({ status: 500 })).toMatch(/server error/);
  });

  it('reports a network hint for fetch/network errors', () => {
    const err = new TypeError('fetch failed');
    expect(sanitizeFailure(err)).toMatch(/could not reach/);
  });

  it('falls back to a generic message otherwise', () => {
    expect(sanitizeFailure(new Error('weird'))).toMatch(/verify configuration/);
  });
});

describe('connection test helpers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('testTautulliConnection succeeds on a successful response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ response: { result: 'success' } }),
    });
    const result = await testTautulliConnection('http://tautulli.local', 'key');
    expect(result.ok).toBe(true);
  });

  it('testTautulliConnection fails on a non-success API result', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ response: { result: 'error' } }),
    });
    const result = await testTautulliConnection('http://tautulli.local', 'bad-key');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/);
  });

  it('testTmdbConnection fails on an HTTP error status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 401 });
    const result = await testTmdbConnection('bad-key');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/);
  });

  it('testResendConnection succeeds on a 200', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const result = await testResendConnection('re_key');
    expect(result.ok).toBe(true);
  });

  it('never throws — network failures resolve to an error result', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('fetch failed'));
    const result = await testResendConnection('re_key');
    expect(result.ok).toBe(false);
  });
});
