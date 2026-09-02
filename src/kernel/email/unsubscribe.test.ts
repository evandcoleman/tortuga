import { describe, it, expect, vi } from 'vitest';
import { generateUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';
import { mintPreferencesToken } from './preferences-token';

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
  it('rejects tokens older than maxAge', () => {
    const hundredDaysMs = 100 * 86_400_000;
    const pastTs = Date.now() - hundredDaysMs;
    // generate a token with a backdated timestamp by mocking Date.now
    vi.spyOn(Date, 'now').mockReturnValueOnce(pastTs);
    const tok = generateUnsubscribeToken('u@x.io', secret);
    vi.restoreAllMocks();
    // default maxAge is 90 days; 100-day-old token must be rejected
    expect(verifyUnsubscribeToken(tok, secret)).toBeNull();
  });
  it('rejects a preferences token replayed as an unsubscribe token', () => {
    const prefTok = mintPreferencesToken('u@x.io', secret);
    expect(verifyUnsubscribeToken(prefTok, secret)).toBeNull();
  });
});
