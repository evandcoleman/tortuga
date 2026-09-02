import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { ServiceNotConfiguredError } from '@/kernel/config/service-settings';
import * as deliverModule from '@/kernel/email/deliver';
import { runDigest } from './run';
import { getThemedPreviews } from './preview-cache';
import { THEMES } from '../templates/themes';
import { LAYOUTS } from '../templates/layouts';
import { digests, sends } from '../schema';
import { setCategory, upsertPreferences } from '@/modules/preferences/repo';

vi.mock('@/kernel/email/deliver', async () => {
  const actual = await vi.importActual<typeof import('@/kernel/email/deliver')>('@/kernel/email/deliver');
  return { ...actual, deliverToRecipients: vi.fn(actual.deliverToRecipients) };
});

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
  const maintainerr = {
    getCollections: vi.fn().mockResolvedValue([
      { id: 1, title: 'Leaving', deleteAfterDays: 7, manualCollection: true, libraryId: 1, type: 'movie' },
    ]),
    getCollectionMedia: vi.fn().mockResolvedValue([
      { id: 100, mediaServerId: 'rk1', addDate: new Date().toISOString() },
    ]),
  };
  return { tautulli, tmdb, provider, llm, maintainerr };
}

const baseConfig = {
  schedule: '0 9 * * SUN', timezone: 'UTC', lookback_days: 7,
  from: { email: 'from@x.io', name: 'T' },
  filters: { min_tmdb_rating: 0, dedupe_episodes_into_seasons: true, max_items_per_section: 12, exclude_genres: [] },
  featured: { enabled: false },
  leaving: { enabled: false, days: 7, excluded_collection_ids: [], heading: 'Leaving soon' },
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

  it('treats a digest as sent (not failed) when every recipient was already sent to (skippedAlreadySent > 0, sent === 0)', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    vi.mocked(deliverModule.deliverToRecipients).mockResolvedValueOnce({
      sent: 0, failed: 0, skippedAlreadySent: 2, firstFailureMessage: undefined,
    });
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-10T13:00:00Z'),
    });
    expect(result.status).toBe('sent');
    const digestRow = db.select().from(digests).where(eq(digests.id, result.id)).all()[0];
    expect(digestRow.status).toBe('sent');
  });

  it('assigns a unique slug at digest creation and stores it on the row', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-10T14:00:00Z'),
    });
    const [row] = db.select().from(digests).all();
    expect(row.slug).toBeTruthy();
    expect(row.slug).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('stores an uncapped web_html snapshot alongside the capped rendered_html', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    tautulli.getRecentlyAdded.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        guid: `g${i}`, title: `M${i}`, mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), year: 2020, raw: {},
      })),
    );
    tmdb.searchMovie.mockResolvedValue({ id: 1, title: 'M', rating: 8, posterUrl: null, overview: 'o' });
    await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: { ...baseConfig, filters: { ...baseConfig.filters, max_items_per_section: 1 } } as any,
      appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-10T15:00:00Z'),
    });
    const [row] = db.select().from(digests).all();
    expect(row.webHtml).toBeTruthy();
    // Web variant has no per-section cap, so it should not show a "View all" link.
    expect(row.webHtml).not.toContain('View all');
    // The email variant is capped and links back to the hosted issue.
    expect(row.renderedHtml).toContain(`/issues/${row.slug}`);
  });

  it('renders the web variant without an unsubscribe link', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider } = fakes();
    await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-10T16:00:00Z'),
    });
    const [row] = db.select().from(digests).all();
    expect(row.webHtml).not.toContain('Unsubscribe');
    expect(row.renderedHtml).toContain('Unsubscribe');
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

  it('does no Maintainerr work when the digest is skipped (no new items)', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider, maintainerr } = fakes();
    tautulli.getRecentlyAdded.mockResolvedValue([]);
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      maintainerr: maintainerr as any,
      config: { ...baseConfig, leaving: { enabled: true, days: 7, excluded_collection_ids: [], heading: 'Leaving soon' } } as any,
      appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-12T13:00:00Z'),
    });
    expect(result.status).toBe('skipped');
    expect(maintainerr.getCollections).not.toHaveBeenCalled();
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
    const themeIds = Object.keys(THEMES).sort();
    const layoutIds = Object.keys(LAYOUTS).sort();
    const expectedPairs = themeIds.flatMap(t => layoutIds.map(l => `${t}:${l}`)).sort();
    const actualPairs = (cached?.previews ?? []).map(p => `${p.themeId}:${p.layoutId}`).sort();
    expect(actualPairs).toEqual(expectedPairs);
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

  describe('unconfigured services', () => {
    it('fails gracefully with a digest row status=failed naming the service when tautulli is null', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tmdb, provider } = fakes();
      await expect(
        runDigest({
          db, tautulli: null, tmdb: tmdb as any, provider: provider as any,
          config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
          scheduledAt: new Date('2026-05-21T13:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(ServiceNotConfiguredError);

      const [row] = db.select().from(digests).all();
      expect(row.status).toBe('failed');
      expect(row.error).toMatch(/Tautulli is not configured/);
    });

    it('fails gracefully naming tmdb when tmdb is null', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, provider } = fakes();
      await expect(
        runDigest({
          db, tautulli: tautulli as any, tmdb: null, provider: provider as any,
          config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
          scheduledAt: new Date('2026-05-22T13:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(ServiceNotConfiguredError);

      const [row] = db.select().from(digests).all();
      expect(row.status).toBe('failed');
      expect(row.error).toMatch(/TMDB is not configured/);
    });

    it('fails gracefully naming email when the provider is null', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb } = fakes();
      await expect(
        runDigest({
          db, tautulli: tautulli as any, tmdb: tmdb as any, provider: null,
          config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
          scheduledAt: new Date('2026-05-23T13:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(ServiceNotConfiguredError);

      const [row] = db.select().from(digests).all();
      expect(row.status).toBe('failed');
      expect(row.error).toMatch(/Email provider is not configured/);
    });

    it('fails gracefully naming the LLM provider when commentary is enabled but llm is null', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider } = fakes();
      await expect(
        runDigest({
          db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
          config: { ...baseConfig, commentary: { enabled: true, provider: 'anthropic', model: '', voice: '' } } as any,
          appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
          scheduledAt: new Date('2026-05-24T13:00:00Z'), llm: null,
        }),
      ).rejects.toBeInstanceOf(ServiceNotConfiguredError);

      const [row] = db.select().from(digests).all();
      expect(row.status).toBe('failed');
      expect(row.error).toMatch(/anthropic/i);
    });

    it('stays fine when commentary is disabled and llm is null', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider } = fakes();
      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        config: { ...baseConfig, commentary: { enabled: false, provider: 'anthropic', model: '', voice: '' } } as any,
        appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt: new Date('2026-05-25T13:00:00Z'), llm: null,
      });
      expect(result.status).toBe('sent');
    });
  });

  describe('leaving-soon', () => {
    const leavingEnabledConfig = {
      ...baseConfig,
      leaving: { enabled: true, days: 7, excluded_collection_ids: [], heading: 'Leaving soon' },
    };

    it('fetches and enriches leaving items when maintainerr is configured and enabled', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider, maintainerr } = fakes();
      const scheduledAt = new Date('2026-05-17T13:00:00Z');
      maintainerr.getCollectionMedia.mockResolvedValue([
        { id: 100, mediaServerId: 'rk1', addDate: new Date(scheduledAt.getTime() - 86_400_000).toISOString() },
      ]);
      (tautulli as any).getMetadata = vi.fn().mockResolvedValue({
        guid: 'leaving-g1', title: 'Leaving Movie', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), raw: {},
      });
      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        maintainerr: maintainerr as any,
        config: leavingEnabledConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt, dryRun: true,
      });
      expect(result.status).toBe('rendered');
      expect(maintainerr.getCollections).toHaveBeenCalledTimes(1);
      expect(maintainerr.getCollectionMedia).toHaveBeenCalledWith(1, expect.any(AbortSignal));
      expect((tautulli as any).getMetadata).toHaveBeenCalledWith('rk1');
    });

    it('does not call maintainerr when leaving.enabled is false', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider, maintainerr } = fakes();
      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        maintainerr: maintainerr as any,
        config: { ...baseConfig, leaving: { enabled: false, days: 7, excluded_collection_ids: [], heading: 'Leaving soon' } } as any,
        appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt: new Date('2026-05-18T13:00:00Z'), dryRun: true,
      });
      expect(result.status).toBe('rendered');
      expect(maintainerr.getCollections).not.toHaveBeenCalled();
    });

    it('does not call maintainerr when no maintainerr client is configured', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider } = fakes();
      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        config: leavingEnabledConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt: new Date('2026-05-19T13:00:00Z'), dryRun: true,
      });
      expect(result.status).toBe('rendered');
    });

    it('gives leaving items a plexUrl using the same mapping as the main list', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider, maintainerr } = fakes();
      const scheduledAt = new Date('2026-05-17T13:00:00Z');
      maintainerr.getCollectionMedia.mockResolvedValue([
        { id: 100, mediaServerId: 'rk1', addDate: new Date(scheduledAt.getTime() - 86_400_000).toISOString() },
      ]);
      (tautulli as any).getMetadata = vi.fn().mockResolvedValue({
        guid: 'leaving-g1', title: 'Leaving Movie', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(),
        raw: { rating_key: '999' },
      });
      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        maintainerr: maintainerr as any,
        config: { ...leavingEnabledConfig, plex: { server_id: 'srv123' } } as any,
        appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt, dryRun: true,
      });
      expect(result.status).toBe('rendered');
      const [row] = db.select().from(digests).where(eq(digests.id, result.id)).all();
      expect(row.renderedHtml).toContain(encodeURIComponent('/library/metadata/999'));
      expect(row.renderedHtml).toContain('srv123');
    });

    it('still completes with an empty leaving list when maintainerr throws', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider, maintainerr } = fakes();
      maintainerr.getCollections.mockRejectedValue(new Error('maintainerr unreachable'));
      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        maintainerr: maintainerr as any,
        config: leavingEnabledConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt: new Date('2026-05-20T13:00:00Z'),
      });
      expect(result.status).toBe('sent');
    });
  });

  describe('recipient preferences', () => {
    function fakesWithThreeRecipients() {
      const f = fakes();
      f.tautulli.getUsers.mockResolvedValue([
        { plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' },
        { plexUserId: 2, name: 'B', plexUsername: 'b', email: 'b@x.io' },
        { plexUserId: 3, name: 'C', plexUsername: 'c', email: 'c@x.io' },
      ]);
      f.tautulli.getRecentlyAdded.mockResolvedValue([
        { guid: 'g1', title: 'M', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), year: 2020, raw: {} },
        { guid: 'g2', title: 'S', mediaType: 'show', libraryName: 'TV Shows', addedAt: new Date(), year: 2020, raw: {} },
      ]);
      f.tmdb.searchMovie.mockResolvedValue({ id: 1, title: 'M', rating: 8, posterUrl: null, overview: 'o' });
      f.tmdb.searchTv.mockResolvedValue({ id: 2, title: 'S', rating: 7, posterUrl: null, overview: 'o' });
      return f;
    }

    it('skips a recipient opted out of digest, sends a library subset to another, and skips a third with no matching library', async () => {
      const db = createDb(':memory:');
      applyMigrations(db);
      const { tautulli, tmdb, provider } = fakesWithThreeRecipients();

      // a: opted out of the digest category entirely.
      setCategory(db, 'a@x.io', 'digest', false);
      // b: only wants the Movies library (a subset of what's in this digest).
      upsertPreferences(db, 'b@x.io', { libraries: ['Movies'] });
      // c: only wants a library that has nothing in this digest.
      upsertPreferences(db, 'c@x.io', { libraries: ['Anime'] });

      const result = await runDigest({
        db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
        config: baseConfig as any, appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
        scheduledAt: new Date('2026-05-25T13:00:00Z'),
      });

      expect(result.status).toBe('sent');
      const sendRows = db.select().from(sends).all();
      const emails = sendRows.map(r => r.recipientEmail).sort();
      // Only b received an email — a opted out, c had no matching library.
      expect(emails).toEqual(['b@x.io']);
      expect(sendRows[0].status).toBe('sent');
    });
  });
});
