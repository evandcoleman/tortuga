import type { TautulliClient } from './tautulli';
import type { TmdbClient } from './tmdb';
import type { EmailProvider } from '@/kernel/email/types';

/** Result of a single connectivity check. Never carries secrets or raw provider output. */
export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface ConnectionTestsResult {
  tautulli: ConnectionTestResult;
  tmdb: ConnectionTestResult;
  email: ConnectionTestResult;
}

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

/**
 * Verify Tautulli reachability + auth with a minimal, side-effect-free call.
 * getUsers is the cheapest authenticated read.
 */
export async function testTautulli(client: TautulliClient): Promise<ConnectionTestResult> {
  try {
    const users = await client.getUsers();
    return { ok: true, message: `Connected — ${users.length} Plex user(s) visible.` };
  } catch (error: unknown) {
    return { ok: false, message: `Tautulli connection failed: ${sanitizeFailure(error)}.` };
  }
}

/**
 * Verify TMDB reachability + auth with a cheap search that has no side effects.
 * A null result still proves the credentials and endpoint work.
 */
export async function testTmdb(client: TmdbClient): Promise<ConnectionTestResult> {
  try {
    await client.searchMovie({ title: 'test' });
    return { ok: true, message: 'Connected — TMDB credentials accepted.' };
  } catch (error: unknown) {
    return { ok: false, message: `TMDB connection failed: ${sanitizeFailure(error)}.` };
  }
}

/**
 * Verify the email provider is configured. Construction validates that the
 * required keys/domain are present without sending any email. We accept a
 * pre-built provider or a factory that may throw on missing config.
 */
export function testEmailProvider(
  build: () => EmailProvider,
): ConnectionTestResult {
  try {
    const provider = build();
    return {
      ok: true,
      message: `Configured — ${provider.name} provider ready (no test email sent).`,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Email provider not configured: ${sanitizeEmailFailure(error)}.`,
    };
  }
}

/**
 * Email factory errors are our own thrown Error messages (e.g. "RESEND_API_KEY
 * required..."). Map them to non-leaky guidance instead of echoing env var names.
 */
export function sanitizeEmailFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/mailgun/i.test(message) && /domain/i.test(message)) {
    return 'set the Mailgun sending domain in Settings';
  }
  if (/mailgun/i.test(message)) {
    return 'set the Mailgun API and webhook signing keys';
  }
  if (/resend/i.test(message)) {
    return 'set the Resend API key';
  }
  return 'check the provider credentials and settings';
}
