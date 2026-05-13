import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type Db = BetterSQLite3Database & { $client: Database.Database };

export function createDb(url: string): Db {
  const path = url.startsWith('file:') ? url.slice('file:'.length) : url;
  const sqlite = new Database(path);
  if (path !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
    sqlite.pragma('foreign_keys = ON');
  }
  const db = drizzle(sqlite) as Db;
  db.$client = sqlite;
  return db;
}
