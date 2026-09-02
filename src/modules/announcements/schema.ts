import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  recipientEmails: text('recipient_emails').notNull(),
  status: text('status').$type<'scheduled' | 'cancelled' | 'sending' | 'sent' | 'partial' | 'failed'>().notNull(),
  renderedHtml: text('rendered_html'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  error: text('error'),
});
