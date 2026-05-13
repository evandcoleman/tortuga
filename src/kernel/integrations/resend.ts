import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import { ResendError } from './errors';

export function createResendClient(apiKey: string) {
  return new Resend(apiKey);
}

export interface VerifyOpts {
  body: string;
  header: string | null;
  secret: string;
}

export function verifyResendSignature(opts: VerifyOpts): boolean {
  if (!opts.header) return false;
  const parts = Object.fromEntries(
    opts.header.split(',').map(s => s.trim().split('=', 2)).filter(p => p.length === 2),
  ) as Record<string, string>;
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const computed = createHmac('sha256', opts.secret).update(`${ts}.${opts.body}`).digest('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export { ResendError };
