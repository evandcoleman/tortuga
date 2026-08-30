import { createMaintainerrClient } from './maintainerr';

/** Result of a single connectivity check. Never carries secrets or raw provider output. */
export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 5000;

/**
 * Convert an unknown thrown value into a safe, user-facing reason fragment.
 * Deliberately coarse: we never surface URLs, API keys, hostnames, or raw
 * response bodies. Only a high-level hint (auth vs. reachability) survives.
 */
export function sanitizeFailure(error: unknown): string {
  const status = extractStatus(error);
  if (status === 401 || status === 403) {
    return 'authentication failed — check the configured API key';
  }
  if (status === 404) {
    return 'endpoint not found — check the configured URL';
  }
  if (typeof status === 'number' && status >= 500) {
    return 'the service returned a server error — try again shortly';
  }
  if (isLikelyNetworkError(error)) {
    return 'could not reach the service — check your connection and URL';
  }
  return 'the request failed — verify configuration and try again';
}

function extractStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  return (
    name === 'typeerror' ||
    name === 'aborterror' ||
    name === 'fetcherror' ||
    /econnrefused|enotfound|etimedout|fetch failed|network/i.test(error.message)
  );
}

class HttpStatusError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/** Verify Tautulli reachability + auth via `get_server_info` — a minimal, side-effect-free call. */
export async function testTautulliConnection(url: string, apiKey: string): Promise<ConnectionTestResult> {
  try {
    const u = new URL('/api/v2', url);
    u.searchParams.set('apikey', apiKey);
    u.searchParams.set('cmd', 'get_server_info');
    const res = await fetchWithTimeout(u.toString());
    if (!res.ok) throw new HttpStatusError(res.status);
    const json = (await res.json()) as { response: { result: string } };
    if (json.response.result !== 'success') throw new HttpStatusError(401);
    return { ok: true, message: 'Connected — Tautulli server reachable.' };
  } catch (error: unknown) {
    return { ok: false, message: `Tautulli connection failed: ${sanitizeFailure(error)}.` };
  }
}

/** Verify TMDB reachability + auth via `/configuration` — a cheap, side-effect-free read. */
export async function testTmdbConnection(apiKey: string): Promise<ConnectionTestResult> {
  try {
    const res = await fetchWithTimeout('https://api.themoviedb.org/3/configuration', {
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new HttpStatusError(res.status);
    return { ok: true, message: 'Connected — TMDB credentials accepted.' };
  } catch (error: unknown) {
    return { ok: false, message: `TMDB connection failed: ${sanitizeFailure(error)}.` };
  }
}

/** Verify Maintainerr reachability via `/api/collections`. */
export async function testMaintainerrConnection(url: string): Promise<ConnectionTestResult> {
  try {
    const client = createMaintainerrClient({ url });
    const collections = await client.getCollections(AbortSignal.timeout(TIMEOUT_MS));
    return { ok: true, message: `Connected — ${collections.length} collection(s) visible.` };
  } catch (error: unknown) {
    return { ok: false, message: `Maintainerr connection failed: ${sanitizeFailure(error)}.` };
  }
}

/** Verify a Resend API key by listing domains — no email is sent. */
export async function testResendConnection(apiKey: string): Promise<ConnectionTestResult> {
  try {
    const res = await fetchWithTimeout('https://api.resend.com/domains', {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new HttpStatusError(res.status);
    return { ok: true, message: 'Connected — Resend API key accepted.' };
  } catch (error: unknown) {
    return { ok: false, message: `Resend connection failed: ${sanitizeFailure(error)}.` };
  }
}

/** Verify a Mailgun API key against the account's domain list — no email is sent. */
export async function testMailgunConnection(
  apiKey: string,
  region: 'us' | 'eu' = 'us',
): Promise<ConnectionTestResult> {
  try {
    const base = region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const res = await fetchWithTimeout(`${base}/v3/domains`, {
      headers: { authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new HttpStatusError(res.status);
    return { ok: true, message: 'Connected — Mailgun API key accepted.' };
  } catch (error: unknown) {
    return { ok: false, message: `Mailgun connection failed: ${sanitizeFailure(error)}.` };
  }
}

/** Verify an Anthropic API key by listing available models — no completion is generated. */
export async function testAnthropicConnection(apiKey: string): Promise<ConnectionTestResult> {
  try {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
    if (!res.ok) throw new HttpStatusError(res.status);
    return { ok: true, message: 'Connected — Anthropic API key accepted.' };
  } catch (error: unknown) {
    return { ok: false, message: `Anthropic connection failed: ${sanitizeFailure(error)}.` };
  }
}

/** Verify an OpenAI API key by listing available models — no completion is generated. */
export async function testOpenaiConnection(apiKey: string): Promise<ConnectionTestResult> {
  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new HttpStatusError(res.status);
    return { ok: true, message: 'Connected — OpenAI API key accepted.' };
  } catch (error: unknown) {
    return { ok: false, message: `OpenAI connection failed: ${sanitizeFailure(error)}.` };
  }
}
