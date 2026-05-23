import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb } from './client';
import { applyMigrations } from './migrate';

describe('applyMigrations', () => {
  // Drizzle's incremental migrator only applies a journal entry whose `when`
  // exceeds the latest already-applied `when`. A new migration with a lower
  // timestamp silently skips on existing DBs (fresh DBs replay everything,
  // hiding the bug). The newest entry must therefore have the max `when`.
  it('has a strictly increasing final journal timestamp', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const journalPath = join(here, '..', '..', '..', 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { idx: number; when: number; tag: string }[];
    };
    const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
    const last = sorted[sorted.length - 1];
    const priorMax = Math.max(...sorted.slice(0, -1).map(e => e.when));
    expect(
      last.when,
      `migration ${last.tag} when (${last.when}) must exceed prior max (${priorMax})`,
    ).toBeGreaterThan(priorMax);
  });

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
