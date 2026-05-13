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
});
