import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

export function applyMigrations(db: Db) {
  migrate(db, { migrationsFolder: './drizzle' });
}
