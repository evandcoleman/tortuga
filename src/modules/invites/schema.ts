import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const invites = sqliteTable('invites', {
  email: text('email').primaryKey(),
  // JSON array of plex.tv GLOBAL library section ids granted on this invite.
  sectionIds: text('section_ids').notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull(),
  // Null until the welcome email successfully sends. Kept null (rather than
  // rolling back the row) when the Plex invite succeeds but the send fails,
  // so "resend welcome" has something to retry against.
  welcomeSentAt: integer('welcome_sent_at', { mode: 'timestamp_ms' }),
  status: text('status').$type<'pending' | 'accepted' | 'cancelled'>().notNull().default('pending'),
});
