import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const recipientPreferences = sqliteTable('recipient_preferences', {
  email: text('email').primaryKey(),
  digest: integer('digest', { mode: 'boolean' }).notNull().default(true),
  announcements: integer('announcements', { mode: 'boolean' }).notNull().default(true),
  // JSON array of Plex section names this recipient wants included. Null = all libraries.
  libraries: text('libraries'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
