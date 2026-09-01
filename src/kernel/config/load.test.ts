import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, loadYamlConfig } from './load';

const baseEnv = {
  TAUTULLI_URL: 'http://localhost:8181',
  TAUTULLI_API_KEY: 'k',
  TMDB_API_KEY: 'k',
  RESEND_API_KEY: 'k',
  APP_URL: 'http://localhost:3000',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('loadEnv', () => {
  it('parses required env vars and applies defaults', () => {
    const env = loadEnv(baseEnv);
    expect(env.AUTH_MODE).toBe('session');
    expect(env.DATABASE_URL).toBe('file:/config/tortuga.db');
  });
  it('throws on missing required vars', () => {
    expect(() => loadEnv({})).toThrow(/APP_URL/);
  });
});

describe('loadYamlConfig', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tortuga-cfg-')); });

  it('parses a valid file', () => {
    const path = join(dir, 'tortuga.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
`);
    const cfg = loadYamlConfig(path);
    expect(cfg.newsletter.schedule).toBe('0 9 * * SUN');
    expect(cfg.newsletter.from.email).toBe('from@example.com');
    rmSync(dir, { recursive: true });
  });

  it('throws when file missing', () => {
    expect(() => loadYamlConfig(join(dir, 'missing.yml'))).toThrow(/required/);
  });

  it('newsletter.email defaults to provider=resend', () => {
    const path = join(dir, 'default-email.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
`);
    const cfg = loadYamlConfig(path);
    expect(cfg.newsletter.email.provider).toBe('resend');
    rmSync(dir, { recursive: true });
  });

  it('newsletter.email parses mailgun provider with domain', () => {
    const path = join(dir, 'mailgun-email.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
  email:
    provider: mailgun
    mailgun:
      domain: example.com
      region: us
`);
    const cfg = loadYamlConfig(path);
    expect(cfg.newsletter.email.provider).toBe('mailgun');
    expect(cfg.newsletter.email.mailgun?.domain).toBe('example.com');
    expect(cfg.newsletter.email.mailgun?.region).toBe('us');
    rmSync(dir, { recursive: true });
  });

  it('parses a top-level portal section', () => {
    const path = join(dir, 'portal.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
portal:
  enabled: true
  domain: plex.example.com
  links:
    request_url: "https://requests.example.com"
  custom:
    - { type: link, label: Wiki, url: "https://wiki.example.com" }
`);
    const cfg = loadYamlConfig(path);
    expect(cfg.portal.enabled).toBe(true);
    expect(cfg.portal.domain).toBe('plex.example.com');
    expect(cfg.portal.links.request_url).toBe('https://requests.example.com');
    expect(cfg.portal.custom).toHaveLength(1);
    rmSync(dir, { recursive: true });
  });

  it('defaults portal to a disabled section when absent from the file', () => {
    const path = join(dir, 'no-portal.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
`);
    const cfg = loadYamlConfig(path);
    expect(cfg.portal.enabled).toBe(false);
    rmSync(dir, { recursive: true });
  });

  it('newsletter.email throws when mailgun selected but no domain', () => {
    const path = join(dir, 'mailgun-no-domain.yml');
    writeFileSync(path, `
newsletter:
  from:
    email: "from@example.com"
    name: "Test"
  email:
    provider: mailgun
`);
    expect(() => loadYamlConfig(path)).toThrow();
    rmSync(dir, { recursive: true });
  });
});
