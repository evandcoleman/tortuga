import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb } from './client';
import { applyMigrations } from './migrate';
import { recipientsCache } from '@/modules/newsletter/schema';

const repoRoot = join(__dirname, '..', '..', '..');
const realMigrationsFolder = join(repoRoot, 'drizzle');

/**
 * Same "prod is behind" harness used in migrate.test.ts, generalized to strip
 * migrations from a specific tag onward (not just the single latest one) — this
 * test targets the 0010 invites/welcomed_at migration specifically, which is no
 * longer necessarily the newest migration in the journal.
 */
function makePriorMigrationsFolder(fromTagPrefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'tortuga-migrations-'));
  cpSync(realMigrationsFolder, dir, { recursive: true });

  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const sorted = [...journal.entries].sort((a: { idx: number }, b: { idx: number }) => a.idx - b.idx);
  const cutIdx = sorted.findIndex((e: { tag: string }) => e.tag.startsWith(fromTagPrefix));
  if (cutIdx === -1) throw new Error(`no migration tagged ${fromTagPrefix} found`);
  const kept = sorted.slice(0, cutIdx);
  const removed = sorted.slice(cutIdx);
  journal.entries = kept;
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));

  for (const entry of removed) {
    unlinkSync(join(dir, `${entry.tag}.sql`));
    const snapshotIdx = String(entry.idx).padStart(4, '0');
    unlinkSync(join(dir, 'meta', `${snapshotIdx}_snapshot.json`));
  }

  return dir;
}

describe('0010 invites + welcomedAt backfill migration', () => {
  let dbFile: string | null = null;
  let tmpMigrationsDir: string | null = null;

  afterEach(() => {
    if (dbFile) { try { unlinkSync(dbFile); } catch { /* noop */ } }
    if (tmpMigrationsDir) { try { rmSync(tmpMigrationsDir, { recursive: true, force: true }); } catch { /* noop */ } }
    dbFile = null;
    tmpMigrationsDir = null;
  });

  it('grandfathers every pre-existing recipient with a non-null welcomedAt', () => {
    tmpMigrationsDir = makePriorMigrationsFolder('0010');
    const dir = mkdtempSync(join(tmpdir(), 'tortuga-db-'));
    dbFile = join(dir, 'tortuga.db');

    const db = createDb(dbFile);
    migrate(db, { migrationsFolder: tmpMigrationsDir });

    // Seed via raw SQL: the temp db is only migrated up to N-1, so it is
    // missing the welcomed_at column the drizzle query builder expects.
    const nowMs = Date.now();
    db.$client.prepare(
      'INSERT INTO recipients_cache (email, name, last_synced, active, source) VALUES (?, ?, ?, ?, ?)',
    ).run('pre-existing@example.com', 'Pre Existing', nowMs, 1, 'plex');

    applyMigrations(db);

    const rows = db.select().from(recipientsCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].welcomedAt).not.toBeNull();
  });

  it('leaves welcomedAt null for recipients inserted after the migration', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    db.insert(recipientsCache).values({
      email: 'new@example.com', name: 'New', lastSynced: new Date(), active: true, source: 'plex',
    }).run();
    const row = db.select().from(recipientsCache).all()[0];
    expect(row.welcomedAt).toBeNull();
  });
});
