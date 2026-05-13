import { describe, it, expect } from 'vitest';
import { generateUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';

describe('unsubscribe tokens', () => {
  const secret = 'a'.repeat(32);
  it('round-trips an email', () => {
    const tok = generateUnsubscribeToken('u@x.io', secret);
    expect(verifyUnsubscribeToken(tok, secret)).toEqual({ email: 'u@x.io' });
  });
  it('rejects tampered tokens', () => {
    const tok = generateUnsubscribeToken('u@x.io', secret) + 'x';
    expect(verifyUnsubscribeToken(tok, secret)).toBeNull();
  });
  it('rejects with wrong secret', () => {
    const tok = generateUnsubscribeToken('u@x.io', secret);
    expect(verifyUnsubscribeToken(tok, 'b'.repeat(32))).toBeNull();
  });
});
