import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { runDigest } from './run';
import { getThemedPreviews } from './preview-cache';
import { THEMES } from '../templates/themes';
import { digests, sends } from '../schema';

function fakes() {
  const tautulli = {
    getUsers: vi.fn().mockResolvedValue([
      { plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' },
      { plexUserId: 2, name: 'B', plexUsername: 'b', email: 'b@x.io' },
    ]),
    getRecentlyAdded: vi.fn().mockResolvedValue([
      { guid: 'g1', title: 'M', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), year: 2020, raw: {} },
    ]),
  };
  const tmdb = {
    searchMovie: vi.fn().mockResolvedValue({ id: 1, title: 'M', rating: 8, posterUrl: null, overview: 'o' }),
    searchTv: vi.fn(),
  };
  const provider = {
    name: 'resend' as const,
    send: vi.fn().mockResolvedValue({ providerMessageId: 'msg_1', error: null }),
    verifyWebhook: vi.fn(),
    parseEvent: vi.fn(),
  };
  const llm = { generateText: vi.fn().mockResolvedValue('An editorial intro.') };
  return { tautulli, tmdb, provider, llm };
}

const baseConfig = {
  schedule: '0 9 * * SUN', timezone: 'UTC', lookback_days: 7,
  from: { email: 'from@x.io', name: 'T' },
  filters: { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 12, exclude_genres: [] },
  featured: { enabled: false },
} as const;

describe('runDigest', () => {
  it('runs full pipeline and records a sent digest', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-10T13:00:00Z'),
    });
    expect(result.status).toBe('sent');
    expect(result.itemCount).toBe(1);
    expect(db.select().from(sends).all()[0].status).toBe('sent');
  });

  it('skips when no items pass filters', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    tautulli.getRecentlyAdded.mockResolvedValue([]);
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-11T13:00:00Z'),
    });
    expect(result.status).toBe('skipped');
    expect(db.select().from(sends).all()).toHaveLength(0);
  });

  it('does not fan out on dry-run', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-12T13:00:00Z'), dryRun: true,
    });
    expect(result.status).toBe('rendered');
    expect(db.select().from(sends).all()).toHaveLength(0);
  });

  it('refuses to double-fire same scheduled_at', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    const at = new Date('2026-05-13T13:00:00Z');
    await runDigest({ db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any, config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32), scheduledAt: at });
    await expect(
      runDigest({ db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any, config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32), scheduledAt: at }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('generates the intro exactly once even with multiple recipients', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider, llm } = fakes();
    await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: { ...baseConfig, commentary: { enabled: true, provider: 'anthropic', model: '', voice: '' } } as any,
      appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-14T13:00:00Z'), llm: llm as any,
    });
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(llm.generateText).toHaveBeenCalledTimes(1);
  });

  it('caches a render of every theme when cacheThemedPreviews is set', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-16T13:00:00Z'), dryRun: true, cacheThemedPreviews: true,
    });
    const cached = getThemedPreviews();
    expect(cached?.previews.map(p => p.id).sort()).toEqual(Object.keys(THEMES).sort());
    expect(cached?.previews.every(p => p.html.includes('New on'))).toBe(true);
  });

  it('still sends when the LLM throws (graceful degradation)', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider, llm } = fakes();
    llm.generateText.mockRejectedValue(new Error('boom'));
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: { ...baseConfig, commentary: { enabled: true, provider: 'anthropic', model: '', voice: '' } } as any,
      appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-15T13:00:00Z'), llm: llm as any,
    });
    expect(result.status).toBe('sent');
  });
});
