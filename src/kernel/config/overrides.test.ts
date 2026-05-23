import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { readConfigOverride, writeConfigOverride, clearConfigOverride } from './overrides';
import { NewsletterConfigSchema } from './schema';

function freshDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

const sample = NewsletterConfigSchema.parse({
  from: { email: 'a@b.com', name: 'A' },
  schedule: '0 8 * * MON',
});

describe('config overrides', () => {
  it('returns null when no override exists', () => {
    expect(readConfigOverride(freshDb())).toBeNull();
  });

  it('round-trips a written override', () => {
    const db = freshDb();
    writeConfigOverride(db, sample);
    const got = readConfigOverride(db);
    expect(got?.schedule).toBe('0 8 * * MON');
    expect(got?.from.email).toBe('a@b.com');
  });

  it('overwrites the single row on repeated writes', () => {
    const db = freshDb();
    writeConfigOverride(db, sample);
    writeConfigOverride(db, { ...sample, schedule: '0 9 * * SUN' });
    expect(readConfigOverride(db)?.schedule).toBe('0 9 * * SUN');
    const count = db.$client.prepare('SELECT COUNT(*) as n FROM config_overrides').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('returns null and does not throw on invalid stored JSON', () => {
    const db = freshDb();
    db.$client.prepare('INSERT INTO config_overrides (id, value, updated_at) VALUES (1, ?, ?)')
      .run('{ not valid json', Date.now());
    expect(readConfigOverride(db)).toBeNull();
  });

  it('clear removes the row', () => {
    const db = freshDb();
    writeConfigOverride(db, sample);
    clearConfigOverride(db);
    expect(readConfigOverride(db)).toBeNull();
  });
});
