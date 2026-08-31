import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import { serviceSettings } from '@/kernel/db/schema';
import { createLogger } from '@/kernel/logging/logger';
import type { Env } from './schema';

const log = createLogger('config.service-settings');

/** The 10 fields that can be configured either via env var or in the UI. Env always wins. */
export const SERVICE_SETTING_KEYS = [
  'tautulli.url',
  'tautulli.api_key',
  'tmdb.api_key',
  'maintainerr.url',
  'resend.api_key',
  'resend.webhook_secret',
  'mailgun.api_key',
  'mailgun.webhook_signing_key',
  'anthropic.api_key',
  'openai.api_key',
  'plex.token',
] as const;

export type ServiceSettingKey = (typeof SERVICE_SETTING_KEYS)[number];

/** 1:1 mapping from managed field to the env var that overrides it. */
const ENV_KEYS: Record<ServiceSettingKey, keyof Env> = {
  'tautulli.url': 'TAUTULLI_URL',
  'tautulli.api_key': 'TAUTULLI_API_KEY',
  'tmdb.api_key': 'TMDB_API_KEY',
  'maintainerr.url': 'MAINTAINERR_URL',
  'resend.api_key': 'RESEND_API_KEY',
  'resend.webhook_secret': 'RESEND_WEBHOOK_SECRET',
  'mailgun.api_key': 'MAILGUN_API_KEY',
  'mailgun.webhook_signing_key': 'MAILGUN_WEBHOOK_SIGNING_KEY',
  'anthropic.api_key': 'ANTHROPIC_API_KEY',
  'openai.api_key': 'OPENAI_API_KEY',
  'plex.token': 'PLEX_TOKEN',
};

export interface ResolvedServiceSetting {
  value: string | undefined;
  source: 'env' | 'db' | undefined;
}

export type ResolvedServiceSettings = Record<ServiceSettingKey, ResolvedServiceSetting>;

/** Thrown by consumers when a required service has no effective configuration (env or db). */
export class ServiceNotConfiguredError extends Error {
  constructor(
    public readonly service: string,
    message: string = `${service} is not configured`,
  ) {
    super(message);
    this.name = 'ServiceNotConfiguredError';
  }
}

const HKDF_SALT = 'tortuga.service-settings';
const HKDF_INFO = 'v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

function deriveKey(sessionSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', sessionSecret, HKDF_SALT, HKDF_INFO, KEY_LENGTH));
}

function encrypt(plaintext: string, sessionSecret: string): string {
  const key = deriveKey(sessionSecret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Returns the decrypted plaintext, or null if the value cannot be decrypted (tampered or wrong key). */
function decrypt(stored: string, sessionSecret: string): string | null {
  try {
    const key = deriveKey(sessionSecret);
    const raw = Buffer.from(stored, 'base64');
    if (raw.length < IV_LENGTH + TAG_LENGTH) return null;
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}

interface ReadOpts {
  /** Injectable for tests; defaults to the shared pino logger. */
  warn?: (obj: Record<string, unknown>, msg: string) => void;
}

/** Keys already warned about this process; keeps the decrypt-failure warn from firing on every read. */
const warnedUndecryptableKeys = new Set<ServiceSettingKey>();

/**
 * Resolves the effective value for every managed service setting. Env vars always win over the
 * DB value. DB values that fail to decrypt (e.g. after a SESSION_SECRET rotation) are treated as
 * unset and reported once via a single aggregated warn log.
 */
export function readServiceSettings(db: Db, env: Env, opts: ReadOpts = {}): ResolvedServiceSettings {
  const warn = opts.warn ?? ((obj: Record<string, unknown>, msg: string) => log.warn(obj, msg));
  const rows = db.select().from(serviceSettings).all();
  const rowByKey = new Map(rows.map(r => [r.key, r.value]));
  const undecryptableKeys: ServiceSettingKey[] = [];

  const resolved = {} as ResolvedServiceSettings;
  for (const key of SERVICE_SETTING_KEYS) {
    const envValue = env[ENV_KEYS[key]];
    if (typeof envValue === 'string' && envValue.length > 0) {
      resolved[key] = { value: envValue, source: 'env' };
      continue;
    }
    const stored = rowByKey.get(key);
    if (stored === undefined) {
      resolved[key] = { value: undefined, source: undefined };
      continue;
    }
    const plaintext = decrypt(stored, env.SESSION_SECRET);
    if (plaintext === null) {
      if (!warnedUndecryptableKeys.has(key)) undecryptableKeys.push(key);
      resolved[key] = { value: undefined, source: undefined };
      continue;
    }
    resolved[key] = { value: plaintext, source: 'db' };
  }

  if (undecryptableKeys.length > 0) {
    warn(
      { keys: undecryptableKeys },
      'service settings failed to decrypt; treating as unset (SESSION_SECRET may have rotated)',
    );
    for (const key of undecryptableKeys) warnedUndecryptableKeys.add(key);
  }

  return resolved;
}

/**
 * Applies a partial update to the managed service settings. A `null` value clears (deletes) the
 * stored row; a string value encrypts and upserts it. Keys not present in the patch are untouched.
 */
export function writeServiceSettings(
  db: Db,
  patch: Partial<Record<ServiceSettingKey, string | null>>,
  env: Env,
): void {
  const updatedAt = new Date();
  for (const [key, value] of Object.entries(patch) as Array<[ServiceSettingKey, string | null | undefined]>) {
    if (value === undefined) continue;
    if (value === null) {
      db.delete(serviceSettings).where(eq(serviceSettings.key, key)).run();
      continue;
    }
    const encrypted = encrypt(value, env.SESSION_SECRET);
    db.insert(serviceSettings)
      .values({ key, value: encrypted, updatedAt })
      .onConflictDoUpdate({ target: serviceSettings.key, set: { value: encrypted, updatedAt } })
      .run();
  }
}
