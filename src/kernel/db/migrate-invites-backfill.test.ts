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

/** Same "prod is one migration behind" harness used in migrate.test.ts. */
function makePriorMigrationsFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tortuga-migrations-'));
  cpSync(realMigrationsFolder, dir, { recursive: true });

  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const last = journal.entries[journal.entries.length - 1];
  journal.entries = journal.entries.slice(0, -1);
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));

  unlinkSync(join(dir, `${last.tag}.sql`));
  const snapshotIdx = String(journal.entries.length).padStart(4, '0');
  unlinkSync(join(dir, 'meta', `${snapshotIdx}_snapshot.json`));

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
    tmpMigrationsDir = makePriorMigrationsFolder();
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
