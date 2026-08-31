import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  // Markdown with {{variables}}; rendered through the announcement/digest
  // email chrome before send. See render.ts.
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
