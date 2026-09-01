import { describe, it, expect } from 'vitest';
import { NewsletterConfigSchema, EnvSchema, PortalConfigSchema, YamlConfigSchema } from './schema';

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

  it('treats a blanked-out optional secret env var as unset instead of failing validation', () => {
    const secretKeys = [
      'TAUTULLI_API_KEY', 'TMDB_API_KEY', 'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET',
      'MAILGUN_API_KEY', 'MAILGUN_WEBHOOK_SIGNING_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
    ] as const;
    for (const key of secretKeys) {
      const env = EnvSchema.parse({
        APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
        [key]: '',
      });
      expect(env[key]).toBeUndefined();
    }
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

describe('NewsletterConfigSchema filters.max_items_leaving_soon', () => {
  it('defaults to unset (uncapped)', () => {
    const cfg = NewsletterConfigSchema.parse(base);
    expect(cfg.filters.max_items_leaving_soon).toBeUndefined();
  });

  it('accepts a positive int', () => {
    const cfg = NewsletterConfigSchema.parse({ ...base, filters: { max_items_leaving_soon: 5 } });
    expect(cfg.filters.max_items_leaving_soon).toBe(5);
  });

  it('rejects zero or negative values', () => {
    expect(() => NewsletterConfigSchema.parse({ ...base, filters: { max_items_leaving_soon: 0 } })).toThrow();
    expect(() => NewsletterConfigSchema.parse({ ...base, filters: { max_items_leaving_soon: -1 } })).toThrow();
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

describe('PortalConfigSchema', () => {
  it('defaults to disabled with built-in pages enabled and no custom entries', () => {
    const cfg = PortalConfigSchema.parse({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.links.plex_url).toBe('https://app.plex.tv');
    expect(cfg.pages.getting_started).toEqual({ enabled: true, markdown: null });
    expect(cfg.pages.rules).toEqual({ enabled: true, markdown: null });
    expect(cfg.pages.report_issue).toEqual({ enabled: true, markdown: null });
    expect(cfg.custom).toEqual([]);
    expect(cfg.appearance).toBeUndefined();
  });

  it('parses an absent portal key in YamlConfigSchema as disabled defaults', () => {
    const cfg = YamlConfigSchema.parse({ newsletter: { from: { email: 'a@b.io', name: 'T' } } });
    expect(cfg.portal.enabled).toBe(false);
  });

  it('parses a fully specified portal section', () => {
    const cfg = PortalConfigSchema.parse({
      enabled: true,
      domain: 'plex.example.com',
      links: { request_url: 'https://req.example', request_label: 'Overseerr', status_url: 'https://status.example' },
      pages: { rules: { enabled: false } },
      custom: [
        { type: 'link', label: 'Wiki', url: 'https://wiki.example' },
        { type: 'page', slug: 'faq', label: 'FAQ', markdown: '# hi' },
      ],
    });
    expect(cfg.domain).toBe('plex.example.com');
    expect(cfg.links.request_url).toBe('https://req.example');
    expect(cfg.pages.rules.enabled).toBe(false);
    expect(cfg.pages.getting_started.enabled).toBe(true);
    expect(cfg.custom).toHaveLength(2);
  });

  it('rejects an invalid custom slug', () => {
    expect(() => PortalConfigSchema.parse({
      custom: [{ type: 'page', slug: 'Not Valid!', label: 'X', markdown: 'x' }],
    })).toThrow();
  });

  it('rejects a reserved custom slug', () => {
    for (const slug of ['getting-started', 'rules', 'report-issue', 'portal', 'issues', 'api', '_next']) {
      expect(() => PortalConfigSchema.parse({
        custom: [{ type: 'page', slug, label: 'X', markdown: 'x' }],
      })).toThrow();
    }
  });

  it('rejects a duplicate custom page slug', () => {
    expect(() => PortalConfigSchema.parse({
      custom: [
        { type: 'page', slug: 'faq', label: 'FAQ', markdown: 'a' },
        { type: 'page', slug: 'faq', label: 'FAQ2', markdown: 'b' },
      ],
    })).toThrow();
  });

  it('rejects a custom page with neither markdown nor html', () => {
    expect(() => PortalConfigSchema.parse({
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ' }],
    })).toThrow();
  });

  it('rejects a custom page with both markdown and html', () => {
    expect(() => PortalConfigSchema.parse({
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ', markdown: 'a', html: '<p>a</p>' }],
    })).toThrow();
  });

  it('accepts a custom page with only html', () => {
    const cfg = PortalConfigSchema.parse({
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ', html: '<p>hi</p>' }],
    });
    expect(cfg.custom[0]).toMatchObject({ type: 'page', slug: 'faq', html: '<p>hi</p>' });
  });

  it('leaves appearance undefined by default and parses an explicit theme + overrides', () => {
    expect(PortalConfigSchema.parse({}).appearance).toBeUndefined();
    const cfg = PortalConfigSchema.parse({
      appearance: { theme: 'editorial', theme_overrides: { colorScheme: 'dark' } },
    });
    expect(cfg.appearance).toEqual({ theme: 'editorial', theme_overrides: { colorScheme: 'dark' } });
  });
});
