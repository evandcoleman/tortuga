import { and, eq } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';

import { recipientsCache, sends } from './schema';

export type SuppressionReason = 'bounce' | 'complaint' | 'admin';

/** Deactivates a cached recipient so future digests/announcements skip them. No-op if the email isn't cached. */
export function suppressRecipient(db: Db, email: string, reason: SuppressionReason): void {
  db.update(recipientsCache).set({ active: false, suppressedReason: reason }).where(eq(recipientsCache.email, email)).run();
}

export interface SuppressRecipientForSendOpts {
  provider: 'resend' | 'mailgun';
  providerMessageId: string;
  reason: SuppressionReason;
}

/**
 * Resolves the recipient tied to a (provider, providerMessageId) send and
 * suppresses them. No-op if no matching send exists — webhook events can
 * arrive for messages we have no record of (e.g. a stale/replayed delivery).
 */
export function suppressRecipientForSend(db: Db, opts: SuppressRecipientForSendOpts): void {
  const send = db.select({ recipientEmail: sends.recipientEmail })
    .from(sends)
    .where(and(eq(sends.providerMessageId, opts.providerMessageId), eq(sends.provider, opts.provider)))
    .get();
  if (!send) return;
  suppressRecipient(db, send.recipientEmail, opts.reason);
}
