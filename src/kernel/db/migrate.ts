import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Db } from './client';
import { createLogger } from '../logging/logger';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', '..', '..', 'drizzle');
const log = createLogger('db.migrate');

export function applyMigrations(db: Db) {
  // The migrator runs each migration inside a transaction, where a
  // `PRAGMA foreign_keys=OFF` statement embedded in the SQL is a silent
  // no-op (SQLite only honors that pragma outside a transaction). Table
  // rebuild migrations (drizzle's pattern for e.g. nullability changes)
  // temporarily drop the table, which trips FK enforcement if another
  // table already holds rows referencing it. Disable enforcement on the
  // raw handle around the whole migrate() call instead, then verify no
  // dangling references were left behind before turning it back on.
  const client = db.$client;
  const fkWasOn = client.pragma('foreign_keys', { simple: true }) === 1;
  if (fkWasOn) client.pragma('foreign_keys = OFF');
  try {
    migrate(db, { migrationsFolder });
    // Migrations are already committed and recorded in drizzle's journal by
    // this point — throwing here would not roll anything back, it would just
    // put the process into a permanent boot loop (every restart re-throws on
    // the already-applied migration). Log and continue so the app can boot;
    // an operator can investigate the logged violations out of band.
    const violations = client.pragma('foreign_key_check');
    if (Array.isArray(violations) && violations.length > 0) {
      log.error({ violations }, 'foreign key violations found after migrate');
    }
  } finally {
    if (fkWasOn) client.pragma('foreign_keys = ON');
  }
}
