import { describe, it, expect, vi } from 'vitest';
import {
  testTautulli,
  testTmdb,
  testEmailProvider,
  sanitizeFailure,
  sanitizeEmailFailure,
} from './connection-tests';
import type { TautulliClient } from './tautulli';
import type { TmdbClient } from './tmdb';
import type { EmailProvider } from '@/kernel/email/types';

describe('sanitizeFailure', () => {
  it('maps 401 to an auth hint without leaking details', () => {
    // Arrange
    const error = Object.assign(new Error('boom'), { status: 401 });

    // Act
    const message = sanitizeFailure(error);

    // Assert
    expect(message).toContain('authentication failed');
    expect(message).not.toContain('boom');
  });

  it('maps 5xx to a transient server error hint', () => {
    const error = Object.assign(new Error('x'), { status: 503 });
    expect(sanitizeFailure(error)).toContain('server error');
  });

  it('maps network errors to a reachability hint', () => {
    const error = new Error('fetch failed');
    expect(sanitizeFailure(error)).toContain('could not reach');
  });

  it('never echoes raw URLs or keys from the error message', () => {
    const error = new Error('GET https://tautulli.local?apikey=SECRET123 failed');
    const message = sanitizeFailure(error);
    expect(message).not.toContain('SECRET123');
    expect(message).not.toContain('tautulli.local');
  });
});

describe('testTautulli', () => {
  it('returns ok with user count on success', async () => {
    // Arrange
    const client = {
      getUsers: vi.fn().mockResolvedValue([{ plexUserId: 1 }, { plexUserId: 2 }]),
    } as unknown as TautulliClient;

    // Act
    const result = await testTautulli(client);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.message).toContain('2 Plex user');
  });

  it('returns sanitized failure on auth error', async () => {
    const client = {
      getUsers: vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 401 })),
    } as unknown as TautulliClient;

    const result = await testTautulli(client);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('authentication failed');
    expect(result.message).not.toContain('nope');
  });
});

describe('testTmdb', () => {
  it('returns ok when the search resolves', async () => {
    const client = {
      searchMovie: vi.fn().mockResolvedValue(null),
    } as unknown as TmdbClient;

    const result = await testTmdb(client);

    expect(result.ok).toBe(true);
    expect(result.message).toContain('credentials accepted');
  });

  it('returns sanitized failure on error', async () => {
    const client = {
      searchMovie: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 401 })),
    } as unknown as TmdbClient;

    const result = await testTmdb(client);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('authentication failed');
  });
});

describe('testEmailProvider', () => {
  it('returns ok with provider name when the factory succeeds', () => {
    const build = () => ({ name: 'resend' } as EmailProvider);

    const result = testEmailProvider(build);

    expect(result.ok).toBe(true);
    expect(result.message).toContain('resend');
    expect(result.message).toContain('no test email sent');
  });

  it('returns a sanitized failure when the factory throws', () => {
    const build = () => {
      throw new Error('RESEND_API_KEY required when provider=resend');
    };

    const result = testEmailProvider(build);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Resend API key');
    expect(result.message).not.toContain('RESEND_API_KEY');
  });
});

describe('sanitizeEmailFailure', () => {
  it('maps a missing Mailgun domain error to guidance', () => {
    const message = sanitizeEmailFailure(
      new Error('newsletter.email.mailgun.domain required when provider=mailgun'),
    );
    expect(message).toContain('Mailgun sending domain');
  });

  it('maps a Resend key error to guidance', () => {
    const message = sanitizeEmailFailure(new Error('RESEND_API_KEY required'));
    expect(message).toContain('Resend API key');
  });
});
