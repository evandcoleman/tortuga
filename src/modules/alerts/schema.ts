import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  key: text('key').notNull(),
  title: text('title').notNull(),
  detail: text('detail'),
  href: text('href'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  acknowledgedAt: integer('acknowledged_at', { mode: 'timestamp_ms' }),
  emailedAt: integer('emailed_at', { mode: 'timestamp_ms' }),
  emailAttempts: integer('email_attempts').notNull().default(0),
}, t => ({
  keyIdx: uniqueIndex('alerts_key_uniq').on(t.key),
}));

export type Alert = typeof alerts.$inferSelect;
