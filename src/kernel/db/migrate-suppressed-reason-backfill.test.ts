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

// Same "prod is behind" harness used in migrate-invites-backfill.test.ts.
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

describe('0012 suppressed_reason backfill migration', () => {
  let dbFile: string | null = null;
  let tmpMigrationsDir: string | null = null;

  afterEach(() => {
    if (dbFile) { try { unlinkSync(dbFile); } catch { /* noop */ } }
    if (tmpMigrationsDir) { try { rmSync(tmpMigrationsDir, { recursive: true, force: true }); } catch { /* noop */ } }
    dbFile = null;
    tmpMigrationsDir = null;
  });

  it("backfills 'admin' onto pre-existing inactive recipients with no reason", () => {
    tmpMigrationsDir = makePriorMigrationsFolder('0012');
    const dir = mkdtempSync(join(tmpdir(), 'tortuga-db-'));
    dbFile = join(dir, 'tortuga.db');

    const db = createDb(dbFile);
    migrate(db, { migrationsFolder: tmpMigrationsDir });

    const nowMs = Date.now();
    db.$client.prepare(
      'INSERT INTO recipients_cache (email, name, last_synced, active, source) VALUES (?, ?, ?, ?, ?)',
    ).run('inactive@example.com', 'Inactive', nowMs, 0, 'plex');
    db.$client.prepare(
      'INSERT INTO recipients_cache (email, name, last_synced, active, source) VALUES (?, ?, ?, ?, ?)',
    ).run('active@example.com', 'Active', nowMs, 1, 'plex');

    applyMigrations(db);

    const rows = db.select().from(recipientsCache).all();
    const inactive = rows.find(r => r.email === 'inactive@example.com')!;
    const active = rows.find(r => r.email === 'active@example.com')!;
    expect(inactive.suppressedReason).toBe('admin');
    expect(active.suppressedReason).toBeNull();
  });

  it('leaves suppressedReason null for recipients inserted after the migration', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    db.insert(recipientsCache).values({
      email: 'new@example.com', name: 'New', lastSynced: new Date(), active: true, source: 'plex',
    }).run();
    const row = db.select().from(recipientsCache).all()[0];
    expect(row.suppressedReason).toBeNull();
  });
});
