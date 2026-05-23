import { describe, it, expect } from 'vitest';
import { createDb } from './client';
import { applyMigrations } from './migrate';

describe('applyMigrations', () => {
  it('creates the users table on a fresh db', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const cols = db.$client.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    expect(cols.map(c => c.name)).toContain('email');
  });

  it('is idempotent', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    expect(() => applyMigrations(db)).not.toThrow();
  });

  it('creates the config_overrides table', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const cols = db.$client.prepare("PRAGMA table_info('config_overrides')").all() as { name: string }[];
    expect(cols.map(c => c.name)).toEqual(expect.arrayContaining(['id', 'value', 'updated_at']));
  });
});
