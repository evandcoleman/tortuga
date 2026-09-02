import { describe, it, expect, vi } from 'vitest';
import { mintPreferencesToken, verifyPreferencesToken, preferencesUrl } from './preferences-token';
import { generateUnsubscribeToken } from './unsubscribe';

describe('preferences tokens', () => {
  const secret = 'a'.repeat(32);

  it('round-trips an email', () => {
    const tok = mintPreferencesToken('u@x.io', secret);
    expect(verifyPreferencesToken(tok, secret)).toEqual({ email: 'u@x.io' });
  });

  it('rejects tampered tokens', () => {
    const tok = mintPreferencesToken('u@x.io', secret) + 'x';
    expect(verifyPreferencesToken(tok, secret)).toBeNull();
  });

  it('rejects with wrong secret', () => {
    const tok = mintPreferencesToken('u@x.io', secret);
    expect(verifyPreferencesToken(tok, 'b'.repeat(32))).toBeNull();
  });

  it('rejects tokens older than the 180 day TTL', () => {
    const past = Date.now() - 181 * 86_400_000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(past);
    const tok = mintPreferencesToken('u@x.io', secret);
    vi.restoreAllMocks();
    expect(verifyPreferencesToken(tok, secret)).toBeNull();
  });

  it('accepts a token just under the TTL', () => {
    const past = Date.now() - 179 * 86_400_000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(past);
    const tok = mintPreferencesToken('u@x.io', secret);
    vi.restoreAllMocks();
    expect(verifyPreferencesToken(tok, secret)).toEqual({ email: 'u@x.io' });
  });

  it('rejects an unsubscribe token replayed as a preferences token', () => {
    const unsubTok = generateUnsubscribeToken('u@x.io', secret);
    expect(verifyPreferencesToken(unsubTok, secret)).toBeNull();
  });

  it('preferencesUrl builds a token-bearing link', () => {
    const url = preferencesUrl('https://app.example', 'u@x.io', secret);
    expect(url.startsWith('https://app.example/preferences?token=')).toBe(true);
    const token = new URL(url).searchParams.get('token')!;
    expect(verifyPreferencesToken(token, secret)).toEqual({ email: 'u@x.io' });
  });
});
