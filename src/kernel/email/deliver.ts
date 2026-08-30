import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';
import { sends, unsubscribes } from '@/modules/newsletter/schema';

import type { EmailProvider, EmailSendOpts } from './types';
import { generateUnsubscribeToken } from './unsubscribe';

export interface DeliverToRecipientsDeps {
  db: Db;
  provider: EmailProvider;
  appUrl: string;
  sessionSecret: string;
}

export interface DeliverRecipient {
  email: string;
  name: string;
}

/** Which parent row a batch of `sends` rows belongs to. */
export type DeliverySendRow = { digestId: string } | { announcementId: string };

export interface DeliverToRecipientsArgs {
  recipients: DeliverRecipient[];
  subject: string;
  from: EmailSendOpts['from'];
  replyTo?: string;
  /** Renders the per-recipient HTML given that recipient's unsubscribe URL. */
  renderFor: (unsubscribeUrl: string) => string | Promise<string>;
  sendRow: DeliverySendRow;
  /**
   * How a `renderFor` exception is handled for a given recipient (a thrown
   * `provider.send` exception is always caught and recorded as a failed
   * send, regardless of this setting):
   *  - 'continue' (default): the `sends` row is inserted *before* rendering,
   *    so a thrown error is caught, recorded as a failed send, and the loop
   *    moves on to the next recipient. Matches announcement sends.
   *  - 'abort': rendering happens *before* the `sends` row is inserted, so a
   *    thrown error propagates out of `deliverToRecipients` (no row is
   *    written for that recipient) and no further recipients are processed.
   *    Matches the newsletter digest send loop.
   */
  onRenderFailure?: 'continue' | 'abort';
}

export interface DeliverToRecipientsResult {
  sent: number;
  failed: number;
  firstFailureMessage?: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

function insertQueuedSend(
  deps: DeliverToRecipientsDeps,
  recipient: DeliverRecipient,
  sendRow: DeliverySendRow,
): string {
  const sendId = createId();
  deps.db.insert(sends).values({
    id: sendId,
    recipientEmail: recipient.email,
    recipientName: recipient.name,
    status: 'queued',
    ...sendRow,
  }).run();
  return sendId;
}

/** Sends the rendered email and records the outcome on the `sends` row. Returns the provider error, if any. */
async function sendAndRecord(
  deps: DeliverToRecipientsDeps,
  args: Pick<DeliverToRecipientsArgs, 'from' | 'subject' | 'replyTo'>,
  sendId: string,
  to: string,
  html: string,
): Promise<string | null> {
  const result = await deps.provider.send({
    from: args.from,
    to,
    subject: args.subject,
    html,
    replyTo: args.replyTo,
  });
  deps.db.update(sends).set({
    providerMessageId: result.providerMessageId,
    provider: deps.provider.name,
    status: result.error ? 'failed' : 'sent',
    sentAt: new Date(),
    error: result.error,
  }).where(eq(sends.id, sendId)).run();
  return result.error;
}

function markSendFailed(deps: DeliverToRecipientsDeps, sendId: string, message: string): void {
  deps.db.update(sends).set({
    status: 'failed', error: message, sentAt: new Date(),
  }).where(eq(sends.id, sendId)).run();
}

/** Tracks running sent/failed counts and the first failure message across the batch. */
interface DeliveryTally {
  sent: number;
  failed: number;
  firstFailureMessage: string | undefined;
}

function recordSuccess(tally: DeliveryTally): DeliveryTally {
  return { ...tally, sent: tally.sent + 1 };
}

function recordFailure(tally: DeliveryTally, message: string): DeliveryTally {
  return { ...tally, failed: tally.failed + 1, firstFailureMessage: tally.firstFailureMessage ?? message };
}

/**
 * Mints an unsubscribe token, renders, and sends one email per recipient,
 * recording a `sends` row for each. Shared by the newsletter digest and
 * announcement send pipelines.
 */
export async function deliverToRecipients(
  deps: DeliverToRecipientsDeps,
  args: DeliverToRecipientsArgs,
): Promise<DeliverToRecipientsResult> {
  const mode = args.onRenderFailure ?? 'continue';
  let tally: DeliveryTally = { sent: 0, failed: 0, firstFailureMessage: undefined };

  for (const recipient of args.recipients) {
    const tokenStr = generateUnsubscribeToken(recipient.email, deps.sessionSecret);
    deps.db.insert(unsubscribes).values({ token: tokenStr, email: recipient.email, createdAt: new Date() }).run();
    const unsubscribeUrl = `${deps.appUrl}/api/unsubscribe?token=${tokenStr}`;

    if (mode === 'abort') {
      const html = await args.renderFor(unsubscribeUrl);
      const sendId = insertQueuedSend(deps, recipient, args.sendRow);
      try {
        const providerError = await sendAndRecord(deps, args, sendId, recipient.email, html);
        tally = providerError ? recordFailure(tally, providerError) : recordSuccess(tally);
      } catch (e) {
        const message = errorMessage(e);
        markSendFailed(deps, sendId, message);
        tally = recordFailure(tally, message);
      }
      continue;
    }

    const sendId = insertQueuedSend(deps, recipient, args.sendRow);
    try {
      const html = await args.renderFor(unsubscribeUrl);
      const providerError = await sendAndRecord(deps, args, sendId, recipient.email, html);
      tally = providerError ? recordFailure(tally, providerError) : recordSuccess(tally);
    } catch (e) {
      const message = errorMessage(e);
      markSendFailed(deps, sendId, message);
      tally = recordFailure(tally, message);
    }
  }

  return { sent: tally.sent, failed: tally.failed, firstFailureMessage: tally.firstFailureMessage };
}
