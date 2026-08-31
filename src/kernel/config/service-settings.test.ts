import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb, type Db } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { serviceSettings } from '@/kernel/db/schema';
import { readServiceSettings, writeServiceSettings, SERVICE_SETTING_KEYS } from './service-settings';
import type { Env } from './schema';

const SESSION_SECRET = 'x'.repeat(32);
const OTHER_SECRET = 'y'.repeat(32);

function baseEnv(over: Partial<Env> = {}): Env {
  return {
    APP_URL: 'http://localhost:3000',
    SESSION_SECRET,
    AUTH_MODE: 'session',
    AUTH_FORWARD_HEADER: 'Remote-User',
    DATABASE_URL: 'file::memory:',
    LOG_LEVEL: 'info',
    CONFIG_PATH: '/config/tortuga.yml',
    ...over,
  } as Env;
}

let db: Db;

beforeEach(() => {
  db = createDb(':memory:');
  applyMigrations(db);
});

describe('service-settings', () => {
  it('lists all 11 managed keys', () => {
    expect(SERVICE_SETTING_KEYS).toHaveLength(11);
    expect(SERVICE_SETTING_KEYS).toEqual(expect.arrayContaining([
      'tautulli.url', 'tautulli.api_key', 'tmdb.api_key', 'maintainerr.url',
      'resend.api_key', 'resend.webhook_secret', 'mailgun.api_key',
      'mailgun.webhook_signing_key', 'anthropic.api_key', 'openai.api_key', 'plex.token',
    ]));
  });

  it('round-trips an encrypted value through write then read', () => {
    writeServiceSettings(db, { 'tautulli.url': 'http://tautulli.local' }, baseEnv());
    const row = db.select().from(serviceSettings).all()[0];
    expect(row.value).not.toContain('tautulli.local');

    const resolved = readServiceSettings(db, baseEnv());
    expect(resolved['tautulli.url']).toEqual({ value: 'http://tautulli.local', source: 'db' });
  });

  it('treats a tampered/undecryptable value as unset and warns once', () => {
    writeServiceSettings(db, { 'tmdb.api_key': 'secret-key' }, baseEnv());
    // Corrupt the stored ciphertext directly.
    db.update(serviceSettings).set({ value: 'not-valid-base64-ciphertext!!' }).run();

    const warnSpy = vi.fn();
    const resolved = readServiceSettings(db, baseEnv(), { warn: warnSpy });
    expect(resolved['tmdb.api_key']).toEqual({ value: undefined, source: undefined });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('also treats a value encrypted with a different secret (rotated SESSION_SECRET) as unset', () => {
    writeServiceSettings(db, { 'tmdb.api_key': 'secret-key' }, baseEnv());
    const resolved = readServiceSettings(db, baseEnv({ SESSION_SECRET: OTHER_SECRET }));
    expect(resolved['tmdb.api_key'].value).toBeUndefined();
  });

  it('env always wins over db', () => {
    writeServiceSettings(db, { 'tautulli.api_key': 'db-value' }, baseEnv());
    const resolved = readServiceSettings(db, baseEnv({ TAUTULLI_API_KEY: 'env-value' }));
    expect(resolved['tautulli.api_key']).toEqual({ value: 'env-value', source: 'env' });
  });

  it('is unset when neither env nor db has a value', () => {
    const resolved = readServiceSettings(db, baseEnv());
    expect(resolved['openai.api_key']).toEqual({ value: undefined, source: undefined });
  });

  it('clear (null) deletes the row', () => {
    writeServiceSettings(db, { 'resend.api_key': 'k' }, baseEnv());
    expect(readServiceSettings(db, baseEnv())['resend.api_key'].value).toBe('k');
    writeServiceSettings(db, { 'resend.api_key': null }, baseEnv());
    expect(readServiceSettings(db, baseEnv())['resend.api_key'].value).toBeUndefined();
  });

  it('patch merges: writing one key leaves other keys untouched', () => {
    writeServiceSettings(db, { 'resend.api_key': 'a', 'mailgun.api_key': 'b' }, baseEnv());
    writeServiceSettings(db, { 'resend.api_key': 'a2' }, baseEnv());
    const resolved = readServiceSettings(db, baseEnv());
    expect(resolved['resend.api_key'].value).toBe('a2');
    expect(resolved['mailgun.api_key'].value).toBe('b');
  });
});
