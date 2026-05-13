import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Db } from './client';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', '..', '..', 'drizzle');

export function applyMigrations(db: Db) {
  migrate(db, { migrationsFolder });
}
