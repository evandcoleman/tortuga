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
  id: integer('id').primaryKey(), // always 1 — single row
  value: text('value').notNull(), // JSON of the full newsletter config
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
