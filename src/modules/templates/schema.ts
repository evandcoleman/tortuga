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

// Tracks one-shot seeding of library templates by slug: once a row exists
// here, the corresponding library template is never re-inserted, even if an
// admin deletes it. The `welcome` template is not tracked here — it keeps
// its own `ON CONFLICT DO NOTHING` semantics.
export const templateSeeds = sqliteTable('template_seeds', {
  slug: text('slug').primaryKey(),
  seededAt: integer('seeded_at', { mode: 'timestamp_ms' }).notNull(),
});
