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

  it('accepts optional ANTHROPIC_API_KEY / OPENAI_API_KEY in env', () => {
    const env = EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
      ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oai',
    });
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant');
    expect(env.OPENAI_API_KEY).toBe('sk-oai');
  });
});
