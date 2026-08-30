import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { render } from '@react-email/render';
import { createElement } from 'react';

import type { Db } from '@/kernel/db/client';
import type { EmailProvider } from '@/kernel/email/types';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';
import type { NewsletterConfig } from '@/kernel/config/schema';

/** The subset of NewsletterConfig this pipeline actually reads. */
export type AnnouncementSendConfig = Pick<NewsletterConfig, 'from' | 'reply_to' | 'theme' | 'appearance'>;
import { createLogger } from '@/kernel/logging/logger';
import { sends, recipientsCache, unsubscribes } from '@/modules/newsletter/schema';

import { announcements } from '../schema';
import { AnnouncementEmail } from '../templates/announcement';

const log = createLogger('announcements.send');

const PLACEHOLDER_EMAIL = 'preview@tortuga.local';

type RenderEmailFn = (
  deps: SendAnnouncementDeps,
  input: SendAnnouncementInput,
  unsubscribeUrl: string,
) => Promise<string>;

export interface SendAnnouncementDeps {
  db: Db;
  provider: EmailProvider;
  config: AnnouncementSendConfig;
  appUrl: string;
  sessionSecret: string;
  /** Test-only override for the render step (used to simulate render failures). */
  renderEmail?: RenderEmailFn;
}

export interface SendAnnouncementInput {
  subject: string;
  body: string;
  /** Must be a subset of active recipients; validated by the caller (server action). */
  recipientEmails: string[];
  /** Render only — no announcement row, no sends. */
  dryRun?: boolean;
  /** Send once to this address only — no announcement row. */
  testRecipient?: string;
}

export interface SendAnnouncementResult {
  html: string;
  announcementId?: string;
  sent: number;
  failed: number;
}

function renderEmail(deps: SendAnnouncementDeps, input: SendAnnouncementInput, unsubscribeUrl: string) {
  return render(
    createElement(AnnouncementEmail, {
      subject: input.subject,
      body: input.body,
      appName: deps.config.from.name,
      themeId: deps.config.theme,
      appearance: deps.config.appearance,
      unsubscribeUrl,
    }),
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

export async function sendAnnouncement(
  deps: SendAnnouncementDeps,
  input: SendAnnouncementInput,
): Promise<SendAnnouncementResult> {
  const renderFn = deps.renderEmail ?? renderEmail;
  const placeholderUnsub = generateUnsubscribeToken(PLACEHOLDER_EMAIL, deps.sessionSecret);

  let html: string;
  try {
    html = await renderFn(deps, input, `${deps.appUrl}/api/unsubscribe?token=${placeholderUnsub}`);
  } catch (e) {
    const message = errorMessage(e);
    log.error({ err: e }, 'announcement render failed');
    // Only a real (non-dry-run, non-test) send tracks a row — record the
    // failure there so it shows up in message history instead of vanishing
    // silently.
    if (!input.dryRun && !input.testRecipient) {
      deps.db.insert(announcements).values({
        id: createId(),
        subject: input.subject,
        body: input.body,
        recipientEmails: JSON.stringify(input.recipientEmails),
        status: 'failed',
        renderedHtml: null,
        createdAt: new Date(),
        error: message,
      }).run();
    }
    throw e;
  }

  if (input.dryRun) {
    return { html, sent: 0, failed: 0 };
  }

  if (input.testRecipient) {
    const tokenStr = generateUnsubscribeToken(input.testRecipient, deps.sessionSecret);
    deps.db.insert(unsubscribes).values({ token: tokenStr, email: input.testRecipient, createdAt: new Date() }).run();
    const testHtml = await renderFn(deps, input, `${deps.appUrl}/api/unsubscribe?token=${tokenStr}`);
    let sent = 0;
    let failed = 0;
    try {
      const result = await deps.provider.send({
        from: deps.config.from,
        to: input.testRecipient,
        subject: input.subject,
        html: testHtml,
        replyTo: deps.config.reply_to,
      });
      if (result.error) failed = 1; else sent = 1;
    } catch (e) {
      failed = 1;
      log.error({ err: e }, 'announcement test send failed');
    }
    return { html, sent, failed };
  }

  const activeRecipients = new Map(
    deps.db.select().from(recipientsCache).all()
      .filter(r => r.active)
      .map(r => [r.email, r] as const),
  );
  const targets = input.recipientEmails.filter(email => activeRecipients.has(email));

  if (targets.length === 0) {
    return { html, sent: 0, failed: 0 };
  }

  const announcementId = createId();
  deps.db.insert(announcements).values({
    id: announcementId,
    subject: input.subject,
    body: input.body,
    recipientEmails: JSON.stringify(targets),
    status: 'sending',
    renderedHtml: html,
    createdAt: new Date(),
  }).run();

  let sent = 0;
  let failed = 0;
  let firstFailureMessage: string | undefined;

  for (const email of targets) {
    const recipient = activeRecipients.get(email)!;
    const sendId = createId();
    const tokenStr = generateUnsubscribeToken(email, deps.sessionSecret);
    deps.db.insert(unsubscribes).values({ token: tokenStr, email, createdAt: new Date() }).run();
    deps.db.insert(sends).values({
      id: sendId, announcementId, recipientEmail: email, recipientName: recipient.name, status: 'queued',
    }).run();
    try {
      const perRecipientHtml = await renderFn(deps, input, `${deps.appUrl}/api/unsubscribe?token=${tokenStr}`);
      const result = await deps.provider.send({
        from: deps.config.from,
        to: email,
        subject: input.subject,
        html: perRecipientHtml,
        replyTo: deps.config.reply_to,
      });
      deps.db.update(sends).set({
        providerMessageId: result.providerMessageId,
        provider: deps.provider.name,
        status: result.error ? 'failed' : 'sent',
        sentAt: new Date(),
        error: result.error,
      }).where(eq(sends.id, sendId)).run();
      if (result.error) {
        failed++;
        firstFailureMessage = firstFailureMessage ?? result.error;
      } else {
        sent++;
      }
    } catch (e) {
      const message = errorMessage(e);
      deps.db.update(sends).set({
        status: 'failed', error: message, sentAt: new Date(),
      }).where(eq(sends.id, sendId)).run();
      failed++;
      firstFailureMessage = firstFailureMessage ?? message;
    }
  }

  const status = sent === 0 ? 'failed' : failed === 0 ? 'sent' : 'partial';
  const errorSummary = failed > 0 ? `${failed} of ${targets.length} failed: ${firstFailureMessage}` : null;
  deps.db.update(announcements).set({ status, sentAt: new Date(), error: errorSummary }).where(eq(announcements.id, announcementId)).run();

  return { html, announcementId, sent, failed };
}
