import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const digests = sqliteTable('digests', {
  id: text('id').primaryKey(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
  ranAt: integer('ran_at', { mode: 'timestamp_ms' }),
  windowStart: integer('window_start', { mode: 'timestamp_ms' }).notNull(),
  windowEnd: integer('window_end', { mode: 'timestamp_ms' }).notNull(),
  status: text('status').$type<'pending' | 'rendered' | 'sending' | 'sent' | 'skipped' | 'failed'>().notNull(),
  itemCount: integer('item_count').notNull().default(0),
  renderedHtml: text('rendered_html'),
  renderedSubject: text('rendered_subject'),
  error: text('error'),
}, t => ({
  scheduledAtIdx: uniqueIndex('digests_scheduled_at_uniq').on(t.scheduledAt),
}));

export const sends = sqliteTable('sends', {
  id: text('id').primaryKey(),
  digestId: text('digest_id').notNull().references(() => digests.id),
  recipientEmail: text('recipient_email').notNull(),
  recipientName: text('recipient_name').notNull(),
  providerMessageId: text('provider_message_id'),
  provider: text('provider').$type<'resend' | 'mailgun'>(),
  status: text('status').$type<'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'>().notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  error: text('error'),
}, t => ({
  digestIdx: index('sends_digest_idx').on(t.digestId),
  emailIdx: index('sends_email_idx').on(t.recipientEmail),
}));

export const sendEvents = sqliteTable('send_events', {
  id: text('id').primaryKey(),
  sendId: text('send_id').references(() => sends.id),
  providerMessageId: text('provider_message_id').notNull(),
  provider: text('provider').$type<'resend' | 'mailgun'>(),
  type: text('type').notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
  payload: text('payload').notNull(),
});

export const recipientsCache = sqliteTable('recipients_cache', {
  email: text('email').primaryKey(),
  name: text('name').notNull(),
  plexUsername: text('plex_username'),
  lastSynced: integer('last_synced', { mode: 'timestamp_ms' }).notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const itemsCache = sqliteTable('items_cache', {
  guid: text('guid').primaryKey(),
  payload: text('payload').notNull(),
  addedAt: integer('added_at', { mode: 'timestamp_ms' }).notNull(),
  cachedAt: integer('cached_at', { mode: 'timestamp_ms' }).notNull(),
});

export const unsubscribes = sqliteTable('unsubscribes', {
  token: text('token').primaryKey(),
  email: text('email').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
});
