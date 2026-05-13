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
    expect(() => loadEnv({})).toThrow(/TAUTULLI_URL/);
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
});
