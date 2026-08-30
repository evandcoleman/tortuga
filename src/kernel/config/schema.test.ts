import { describe, it, expect } from 'vitest';
import { NewsletterConfigSchema, EnvSchema } from './schema';

const base = { from: { email: 'a@b.io', name: 'T' } };

describe('NewsletterConfigSchema commentary/extras', () => {
  it('defaults commentary to disabled and extras to undefined', () => {
    const cfg = NewsletterConfigSchema.parse(base);
    expect(cfg.commentary.enabled).toBe(false);
    expect(cfg.commentary.provider).toBe('anthropic');
    expect(cfg.extras).toBeUndefined();
  });

  it('parses a full commentary + extras block', () => {
    const cfg = NewsletterConfigSchema.parse({
      ...base,
      commentary: { enabled: true, provider: 'openai', model: 'gpt-4o-mini', voice: 'snappy' },
      extras: { request_url: 'https://req.example', personal_url: 'https://example.com', freeform_markdown: '# hi' },
    });
    expect(cfg.commentary).toMatchObject({ enabled: true, provider: 'openai', model: 'gpt-4o-mini', voice: 'snappy' });
    expect(cfg.extras).toMatchObject({ request_url: 'https://req.example', request_label: 'Request a title' });
  });

  it('defaults schedule_enabled to true and parses false', () => {
    expect(NewsletterConfigSchema.parse({ from: { email: 'a@b.io', name: 'T' } }).schedule_enabled).toBe(true);
    expect(NewsletterConfigSchema.parse({ from: { email: 'a@b.io', name: 'T' }, schedule_enabled: false }).schedule_enabled).toBe(false);
  });

  it('accepts optional ANTHROPIC_API_KEY / OPENAI_API_KEY in env', () => {
    const env = EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
      ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oai',
    });
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant');
    expect(env.OPENAI_API_KEY).toBe('sk-oai');
  });

  it('accepts optional MAINTAINERR_URL in env', () => {
    const env = EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
      MAINTAINERR_URL: 'http://maintainerr.service.consul:6246',
    });
    expect(env.MAINTAINERR_URL).toBe('http://maintainerr.service.consul:6246');
  });

  it('leaves MAINTAINERR_URL undefined when absent', () => {
    const env = EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
    });
    expect(env.MAINTAINERR_URL).toBeUndefined();
  });

  it('treats an empty-string MAINTAINERR_URL as unset', () => {
    const env = EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
      MAINTAINERR_URL: '',
    });
    expect(env.MAINTAINERR_URL).toBeUndefined();
  });

  it('still rejects an invalid non-empty MAINTAINERR_URL', () => {
    expect(() => EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
      MAINTAINERR_URL: 'not-a-url',
    })).toThrow();
  });
});

describe('NewsletterConfigSchema leaving', () => {
  it('defaults leaving to enabled with a 7 day window and no exclusions', () => {
    const cfg = NewsletterConfigSchema.parse(base);
    expect(cfg.leaving).toEqual({
      enabled: true, days: 7, excluded_collection_ids: [], heading: 'Leaving soon',
    });
  });

  it('parses a fully-specified leaving block', () => {
    const cfg = NewsletterConfigSchema.parse({
      ...base,
      leaving: { enabled: false, days: 30, excluded_collection_ids: [1, 2], heading: 'Going away' },
    });
    expect(cfg.leaving).toEqual({
      enabled: false, days: 30, excluded_collection_ids: [1, 2], heading: 'Going away',
    });
  });

  it('rejects days outside 1-90', () => {
    expect(() => NewsletterConfigSchema.parse({ ...base, leaving: { days: 0 } })).toThrow();
    expect(() => NewsletterConfigSchema.parse({ ...base, leaving: { days: 91 } })).toThrow();
  });

  it('rejects an empty or too-long heading', () => {
    expect(() => NewsletterConfigSchema.parse({ ...base, leaving: { heading: '' } })).toThrow();
    expect(() => NewsletterConfigSchema.parse({ ...base, leaving: { heading: 'x'.repeat(81) } })).toThrow();
  });

  it('still parses an existing config without a leaving key (backwards compatible)', () => {
    const stored = { ...base, filters: { min_tmdb_rating: 3 } };
    const cfg = NewsletterConfigSchema.parse(stored);
    expect(cfg.leaving.enabled).toBe(true);
    expect(cfg.leaving.days).toBe(7);
  });
});

describe('NewsletterConfigSchema timezone', () => {
  it('accepts a valid IANA timezone', () => {
    const cfg = NewsletterConfigSchema.parse({ ...base, timezone: 'America/Los_Angeles' });
    expect(cfg.timezone).toBe('America/Los_Angeles');
  });

  it('rejects an invalid timezone', () => {
    const result = NewsletterConfigSchema.safeParse({ ...base, timezone: 'Not/AZone' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.join('.') === 'timezone');
      expect(issue?.message).toBe('Invalid IANA timezone');
    }
  });
});
