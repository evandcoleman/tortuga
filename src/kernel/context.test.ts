import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getAppContext,
  getPortalHostConfigFresh,
  invalidateAppContext,
  resetAppContextForTests,
  PORTAL_HOST_CONFIG_TTL_MS,
} from './context';
import { writeConfigOverride, clearConfigOverride } from './config/overrides';
import { NewsletterConfigSchema, PortalConfigSchema } from './config/schema';
import { writeServiceSettings } from './config/service-settings';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tortuga-ctx-'));
  writeFileSync(
    join(dir, 'tortuga.yml'),
    'newsletter:\n  from:\n    email: file@example.com\n    name: File\n  schedule: "0 9 * * SUN"\n',
  );
  process.env.TAUTULLI_URL = 'http://localhost:8181';
  process.env.TAUTULLI_API_KEY = 'x';
  process.env.TMDB_API_KEY = 'x';
  process.env.RESEND_API_KEY = 'x';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'x'.repeat(32);
  process.env.AUTH_MODE = 'forward';
  process.env.DATABASE_URL = `file:${join(dir, 'tortuga.db')}`;
  process.env.CONFIG_PATH = join(dir, 'tortuga.yml');
  resetAppContextForTests();
});

afterEach(() => {
  resetAppContextForTests();
  rmSync(dir, { recursive: true, force: true });
});

describe('getAppContext config resolution', () => {
  it('uses the file config when no override exists', () => {
    expect(getAppContext().config.newsletter.from.email).toBe('file@example.com');
  });

  it('prefers a DB override over the file after invalidate', async () => {
    const override = NewsletterConfigSchema.parse({
      from: { email: 'override@example.com', name: 'Override' },
      schedule: '30 7 * * MON',
    });
    writeConfigOverride(getAppContext().db, 'newsletter', override);
    await invalidateAppContext();
    const ctx = getAppContext();
    expect(ctx.config.newsletter.from.email).toBe('override@example.com');
    expect(ctx.config.newsletter.schedule).toBe('30 7 * * MON');
  });

  it('re-registers the digest cron job reflecting the new schedule', async () => {
    await invalidateAppContext();
    const jobs = getAppContext().scheduler.list();
    expect(jobs.map(j => j.name)).toContain('newsletter.digest');
  });

  it('registers no digest cron when schedule_enabled is false, but keeps announcements polling', async () => {
    const override = NewsletterConfigSchema.parse({
      from: { email: 'a@b.com', name: 'A' },
      schedule_enabled: false,
    });
    writeConfigOverride(getAppContext().db, 'newsletter', override);
    await invalidateAppContext();
    const jobs = getAppContext().scheduler.list().map(j => j.name);
    expect(jobs).not.toContain('newsletter.digest');
    expect(jobs).toContain('announcements.scheduled');
  });

  it('does not create a maintainerr client when MAINTAINERR_URL is unset', () => {
    expect(getAppContext().maintainerr).toBeUndefined();
  });

  it('creates a maintainerr client when MAINTAINERR_URL is set', () => {
    process.env.MAINTAINERR_URL = 'http://maintainerr.local:6246';
    resetAppContextForTests();
    expect(getAppContext().maintainerr).toBeDefined();
    delete process.env.MAINTAINERR_URL;
  });
});

describe('getAppContext portal resolution', () => {
  it('defaults portal to disabled when absent from YAML and no override', () => {
    expect(getAppContext().portal.enabled).toBe(false);
    expect(getAppContext().portal.links.plexUrl).toBe('https://app.plex.tv');
  });

  it('prefers a DB portal override over YAML after invalidate', async () => {
    const override = PortalConfigSchema.parse({ enabled: true, domain: 'plex.example.com' });
    writeConfigOverride(getAppContext().db, 'portal', override);
    await invalidateAppContext();
    const ctx = getAppContext();
    expect(ctx.portal.enabled).toBe(true);
    expect(ctx.portal.domain).toBe('plex.example.com');
  });

  it('falls back portal request_url/request_label from newsletter extras', async () => {
    const newsletterOverride = NewsletterConfigSchema.parse({
      from: { email: 'a@b.com', name: 'A' },
      extras: { request_url: 'https://req.example', request_label: 'Overseerr' },
    });
    writeConfigOverride(getAppContext().db, 'newsletter', newsletterOverride);
    await invalidateAppContext();
    const ctx = getAppContext();
    expect(ctx.portal.links.requestUrl).toBe('https://req.example');
    expect(ctx.portal.links.requestLabel).toBe('Overseerr');
  });
});

describe('getPortalHostConfigFresh', () => {
  it('defaults to disabled when nothing is configured', () => {
    expect(getPortalHostConfigFresh()).toEqual({ enabled: false, domain: undefined });
  });

  it('reflects a DB override immediately, without invalidateAppContext (simulates middleware running in a separate module instance)', () => {
    const override = PortalConfigSchema.parse({ enabled: true, domain: 'plex.example.com' });
    writeConfigOverride(getAppContext().db, 'portal', override);

    // Note: no invalidateAppContext() call — the cached AppContext.portal is
    // stale here, but the fresh reader must not depend on that invalidation.
    expect(getAppContext().portal.enabled).toBe(false);
    expect(getPortalHostConfigFresh()).toEqual({ enabled: true, domain: 'plex.example.com' });
  });

  it('falls back to the YAML file, not a stale cached override, once the override is cleared and the memo TTL elapses', async () => {
    const override = PortalConfigSchema.parse({ enabled: true, domain: 'plex.example.com' });
    writeConfigOverride(getAppContext().db, 'portal', override);
    await invalidateAppContext();
    expect(getPortalHostConfigFresh()).toEqual({ enabled: true, domain: 'plex.example.com' });

    clearConfigOverride(getAppContext().db, 'portal');
    // Again, no invalidateAppContext() — proves this doesn't read the cached ctx.config.portal.
    // It does still honor the short memo TTL (see `memoization` below), so advance past it
    // before asserting (switching back to real timers first would reset the clock to "now",
    // which is still within the TTL window of the earlier real-time read).
    vi.useFakeTimers();
    vi.advanceTimersByTime(PORTAL_HOST_CONFIG_TTL_MS);
    expect(getPortalHostConfigFresh()).toEqual({ enabled: false, domain: undefined });
    vi.useRealTimers();
  });

  describe('memoization', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns a memoized value within the TTL instead of re-reading the DB/YAML', () => {
      vi.useFakeTimers();
      expect(getPortalHostConfigFresh()).toEqual({ enabled: false, domain: undefined });

      const override = PortalConfigSchema.parse({ enabled: true, domain: 'plex.example.com' });
      writeConfigOverride(getAppContext().db, 'portal', override);

      // Still within the TTL — should still see the stale memoized value.
      vi.advanceTimersByTime(PORTAL_HOST_CONFIG_TTL_MS - 1);
      expect(getPortalHostConfigFresh()).toEqual({ enabled: false, domain: undefined });
    });

    it('re-reads once the TTL has elapsed', () => {
      vi.useFakeTimers();
      expect(getPortalHostConfigFresh()).toEqual({ enabled: false, domain: undefined });

      const override = PortalConfigSchema.parse({ enabled: true, domain: 'plex.example.com' });
      writeConfigOverride(getAppContext().db, 'portal', override);

      vi.advanceTimersByTime(PORTAL_HOST_CONFIG_TTL_MS);
      expect(getPortalHostConfigFresh()).toEqual({ enabled: true, domain: 'plex.example.com' });
    });
  });
});

describe('getAppContext service settings resolution', () => {
  beforeEach(() => {
    // These tests exercise the env-unset / db-configured / env-beats-db matrix, so
    // clear the always-set env values from the outer beforeEach.
    delete process.env.TAUTULLI_URL;
    delete process.env.TAUTULLI_API_KEY;
    delete process.env.TMDB_API_KEY;
    delete process.env.RESEND_API_KEY;
    resetAppContextForTests();
  });

  it('leaves tautulli/tmdb/email null when nothing is configured', () => {
    const ctx = getAppContext();
    expect(ctx.tautulli).toBeNull();
    expect(ctx.tmdb).toBeNull();
    expect(ctx.email).toBeNull();
  });

  it('builds a tautulli client from db-configured settings', async () => {
    const ctx = getAppContext();
    writeServiceSettings(
      ctx.db,
      { 'tautulli.url': 'http://tautulli.db.local', 'tautulli.api_key': 'db-key' },
      ctx.env,
    );
    await invalidateAppContext();
    expect(getAppContext().tautulli).not.toBeNull();
  });

  it('env value wins over a db value for the same field', async () => {
    const ctx = getAppContext();
    writeServiceSettings(
      ctx.db,
      { 'tmdb.api_key': 'db-key' },
      ctx.env,
    );
    process.env.TMDB_API_KEY = 'env-key';
    await invalidateAppContext();
    expect(getAppContext().tmdb).not.toBeNull();
    delete process.env.TMDB_API_KEY;
  });

  it('builds successfully (llm null) when commentary is enabled but no provider key is configured', async () => {
    const override = NewsletterConfigSchema.parse({
      from: { email: 'a@b.com', name: 'A' },
      commentary: { enabled: true, provider: 'anthropic', model: '', voice: '', disclaimer: false },
    });
    writeConfigOverride(getAppContext().db, 'newsletter', override);
    await expect(invalidateAppContext()).resolves.not.toThrow();
    expect(getAppContext().llm).toBeNull();
  });
});
