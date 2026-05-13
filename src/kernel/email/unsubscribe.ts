import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function generateUnsubscribeToken(email: string, secret: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ email, t: Date.now() })));
  const sig = b64url(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): { email: string } | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const got = b64urlDecode(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(payload).toString('utf8'));
    if (typeof parsed.email !== 'string') return null;
    return { email: parsed.email };
  } catch { return null; }
}
