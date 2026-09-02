import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

import { announcements } from '@/modules/announcements/schema';

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
  /** Unguessable slug for the hosted issue URL. Nullable: existing digests predate this feature and never get one. */
  slug: text('slug'),
  /** Uncapped web-variant HTML for the hosted issue page (immutable snapshot). */
  webHtml: text('web_html'),
}, t => ({
  scheduledAtIdx: uniqueIndex('digests_scheduled_at_uniq').on(t.scheduledAt),
  slugIdx: uniqueIndex('digests_slug_uniq').on(t.slug),
}));

export const sends = sqliteTable('sends', {
  id: text('id').primaryKey(),
  digestId: text('digest_id').references(() => digests.id),
  announcementId: text('announcement_id').references(() => announcements.id),
  recipientEmail: text('recipient_email').notNull(),
  recipientName: text('recipient_name').notNull(),
  providerMessageId: text('provider_message_id'),
  provider: text('provider').$type<'resend' | 'mailgun'>(),
  status: text('status').$type<'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'>().notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  error: text('error'),
}, t => ({
  digestIdx: index('sends_digest_idx').on(t.digestId),
  announcementIdx: index('sends_announcement_idx').on(t.announcementId),
  emailIdx: index('sends_email_idx').on(t.recipientEmail),
}));

export const sendEvents = sqliteTable('send_events', {
  id: text('id').primaryKey(),
  sendId: text('send_id').references(() => sends.id),
  providerMessageId: text('provider_message_id'),
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
  source: text('source').$type<'plex' | 'manual'>().notNull().default('plex'),
  // Null = "not welcomed" (either invited outside Tortuga, or a Tortuga
  // invite whose welcome email hasn't sent yet). The migration adding this
  // column backfills existing rows to non-null so pre-feature users are
  // grandfathered rather than flagged.
  welcomedAt: integer('welcomed_at', { mode: 'timestamp_ms' }),
  // Only meaningful when active = false. Null on active rows and on legacy
  // inactive rows predating this column (backfilled to 'admin' by migration).
  suppressedReason: text('suppressed_reason').$type<'bounce' | 'complaint' | 'admin'>(),
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
  // Which category this token's claim opts the recipient out of. Existing
  // rows predate this column and are backfilled to 'digest' by migration.
  category: text('category').$type<'digest' | 'announcements'>().notNull().default('digest'),
});
