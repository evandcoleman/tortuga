import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAppContext, invalidateAppContext, resetAppContextForTests } from './context';
import { writeConfigOverride } from './config/overrides';
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

  it('re-registers exactly one cron job reflecting the new schedule', async () => {
    await invalidateAppContext();
    const jobs = getAppContext().scheduler.list();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe('newsletter.digest');
  });

  it('registers no cron when schedule_enabled is false', async () => {
    const override = NewsletterConfigSchema.parse({
      from: { email: 'a@b.com', name: 'A' },
      schedule_enabled: false,
    });
    writeConfigOverride(getAppContext().db, 'newsletter', override);
    await invalidateAppContext();
    expect(getAppContext().scheduler.list()).toHaveLength(0);
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
