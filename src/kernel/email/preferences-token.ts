import { signPayload, verifySignedPayload } from './hmac-token';

const TTL_MS = 180 * 86_400_000; // 180 days

/** Reusable token linking to the recipient preferences page. Not stored or claimed, unlike the one-shot unsubscribe token. */
export function mintPreferencesToken(email: string, secret: string): string {
  return signPayload({ email, kind: 'preferences', t: Date.now() }, secret);
}

export function verifyPreferencesToken(token: string, secret: string): { email: string } | null {
  const parsed = verifySignedPayload(token, secret) as
    { email?: unknown; t?: unknown; kind?: unknown } | null;
  if (!parsed || typeof parsed.email !== 'string') return null;
  if (parsed.kind !== 'preferences') return null;
  if (typeof parsed.t === 'number' && Date.now() - parsed.t > TTL_MS) return null;
  return { email: parsed.email };
}

/** Builds the `/preferences` link for a recipient, minting a fresh preferences token. */
export function preferencesUrl(appUrl: string, email: string, secret: string): string {
  const token = mintPreferencesToken(email, secret);
  return `${appUrl}/preferences?token=${token}`;
}
