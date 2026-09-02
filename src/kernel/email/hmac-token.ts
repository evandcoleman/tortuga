import { createHmac, timingSafeEqual } from 'node:crypto';

/** Shared base64url encode/decode + HMAC-SHA256 sign/verify used by the unsubscribe and preferences tokens. */
export const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64urlDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function signPayload(payload: unknown, secret: string): string {
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(encoded).digest());
  return `${encoded}.${sig}`;
}

/** Verifies the HMAC and returns the parsed payload, or null on any tamper/parse failure. */
export function verifySignedPayload(token: string, secret: string): unknown | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const got = b64urlDecode(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    return JSON.parse(b64urlDecode(payload).toString('utf8'));
  } catch {
    return null;
  }
}
