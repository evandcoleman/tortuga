import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb } from './client';
import { applyMigrations } from './migrate';
import { digests, sends, sendEvents } from '@/modules/newsletter/schema';

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }));
vi.mock('@/kernel/logging/logger', () => ({
  createLogger: () => ({ error: loggerError }),
}));

const repoRoot = join(__dirname, '..', '..', '..');
const realMigrationsFolder = join(repoRoot, 'drizzle');

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

  it('logs and does not throw when foreign_key_check finds violations after migrate', () => {
    loggerError.mockReset();
    const db = createDb(':memory:');
    applyMigrations(db);

    // Insert a dangling reference directly with enforcement off — simulating
    // a violation left behind by an earlier, buggy migration.
    db.$client.pragma('foreign_keys = OFF');
    db.$client.prepare(
      'INSERT INTO sends (id, digest_id, recipient_email, recipient_name, status) VALUES (?, ?, ?, ?, ?)',
    ).run('dangling-send', 'no-such-digest', 'a@x.io', 'A', 'sent');
    db.$client.pragma('foreign_keys = ON');

    expect(() => applyMigrations(db)).not.toThrow();
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ violations: expect.any(Array) }),
      expect.stringContaining('foreign key violations'),
    );
    expect((loggerError.mock.calls[0][0] as { violations: unknown[] }).violations.length).toBeGreaterThan(0);
  });

  it('creates the config_overrides table', () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const cols = db.$client.prepare("PRAGMA table_info('config_overrides')").all() as { name: string }[];
    expect(cols.map(c => c.name)).toEqual(expect.arrayContaining(['id', 'value', 'updated_at']));
  });

  describe('table-rebuild migrations on a real (foreign_keys=ON) db', () => {
    /**
     * Builds a copy of drizzle/ with the most recent migration (and its
     * journal entry / snapshot) removed, simulating "prod is on migration
     * N-1" so we can apply 0000..N-1 for real, seed rows, then apply the
     * final migration for real via the production `applyMigrations` path.
     */
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

    let dbFile: string | null = null;
    let tmpMigrationsDir: string | null = null;

    afterEach(() => {
      if (dbFile) { try { unlinkSync(dbFile); } catch { /* noop */ } }
      if (tmpMigrationsDir) { try { rmSync(tmpMigrationsDir, { recursive: true, force: true }); } catch { /* noop */ } }
      dbFile = null;
      tmpMigrationsDir = null;
    });

    it('applies the latest migration without tripping foreign_keys on rows that reference a rebuilt table', () => {
      tmpMigrationsDir = makePriorMigrationsFolder();
      const dir = mkdtempSync(join(tmpdir(), 'tortuga-db-'));
      dbFile = join(dir, 'tortuga.db');

      const db = createDb(dbFile);
      expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);

      // Apply every migration except the latest — mimics prod being one
      // version behind before this deploy.
      migrate(db, { migrationsFolder: tmpMigrationsDir });

      // Seed via raw SQL (not the drizzle query builder, which is bound to
      // the *current* schema — the temp db here is only migrated up to N-1
      // and is missing columns, e.g. `announcement_id`, introduced by the
      // latest migration).
      const nowMs = Date.now();
      db.$client.prepare(
        'INSERT INTO digests (id, scheduled_at, window_start, window_end, status, item_count) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('d1', nowMs, nowMs, nowMs, 'sent', 1);
      db.$client.prepare(
        'INSERT INTO sends (id, digest_id, recipient_email, recipient_name, status) VALUES (?, ?, ?, ?, ?)',
      ).run('s1', 'd1', 'a@x.io', 'A', 'sent');
      db.$client.prepare(
        'INSERT INTO send_events (id, send_id, provider_message_id, type, received_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('e1', 's1', 'msg_1', 'delivered', nowMs, '{}');

      // Now apply the real, full migration set (including the latest one,
      // which rebuilds `sends`) via the production code path.
      expect(() => applyMigrations(db)).not.toThrow();

      expect(db.select().from(digests).all()).toHaveLength(1);
      expect(db.select().from(sends).all()).toHaveLength(1);
      expect(db.select().from(sendEvents).all()).toHaveLength(1);

      const violations = db.$client.pragma('foreign_key_check');
      expect(violations).toEqual([]);
      expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);
    });
  });
});
