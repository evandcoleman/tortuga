import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyResendSignature } from './resend';

describe('verifyResendSignature', () => {
  it('accepts valid signature', () => {
    const secret = 'whsec_test';
    const body = '{"type":"email.delivered"}';
    const ts = '1700000000';
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(verifyResendSignature({ body, header: `t=${ts},v1=${sig}`, secret })).toBe(true);
  });

  it('rejects tampered body', () => {
    const secret = 'whsec_test';
    const ts = '1700000000';
    const sig = createHmac('sha256', secret).update(`${ts}.original`).digest('hex');
    expect(verifyResendSignature({ body: 'tampered', header: `t=${ts},v1=${sig}`, secret })).toBe(false);
  });

  it('rejects malformed header', () => {
    expect(verifyResendSignature({ body: 'x', header: 'garbage', secret: 'x' })).toBe(false);
  });
});
