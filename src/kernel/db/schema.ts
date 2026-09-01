import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});

export const configOverrides = sqliteTable('config_overrides', {
  id: integer('id').primaryKey(), // auto-assigned by sqlite rowid; not looked up directly
  // Config section this row overrides, e.g. 'newsletter' or 'portal'. One row per section.
  // Existing rows predate this column and were backfilled to 'newsletter' by migration 0011.
  section: text('section').notNull().unique().default('newsletter'),
  value: text('value').notNull(), // JSON of the section's config
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const serviceSettings = sqliteTable('service_settings', {
  key: text('key').primaryKey(), // e.g. 'tautulli.url'
  value: text('value').notNull(), // AES-256-GCM encrypted, base64(iv‖tag‖ciphertext)
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
