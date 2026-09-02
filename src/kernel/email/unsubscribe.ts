import { signPayload, verifySignedPayload } from './hmac-token';

export function generateUnsubscribeToken(email: string, secret: string): string {
  return signPayload({ email, t: Date.now() }, secret);
}

const DEFAULT_MAX_AGE_MS = 90 * 86_400_000; // 90 days

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): { email: string } | null {
  const parsed = verifySignedPayload(token, secret) as
    { email?: unknown; t?: unknown; kind?: unknown } | null;
  if (!parsed || typeof parsed.email !== 'string') return null;
  // Legacy unsubscribe tokens predate `kind` and have none; only reject
  // tokens explicitly minted as a different kind (e.g. 'preferences').
  if ('kind' in parsed && parsed.kind !== undefined && parsed.kind !== 'unsubscribe') return null;
  if (typeof parsed.t === 'number' && Date.now() - parsed.t > maxAgeMs) return null;
  return { email: parsed.email };
}
