import { render } from '@react-email/render';
import { createElement } from 'react';
import { and, asc, eq, lte } from 'drizzle-orm';

import { createLogger } from '@/kernel/logging/logger';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';
import { selectDeliverableRecipients } from '@/kernel/email/deliver';

import { announcements } from '../schema';
import { AnnouncementEmail } from '../templates/announcement';
import { deliverAnnouncement, type SendAnnouncementDeps } from './send';

const log = createLogger('announcements.run-due');

const PLACEHOLDER_EMAIL = 'preview@tortuga.local';
const NO_DELIVERABLE_RECIPIENTS_ERROR = 'No deliverable recipients at send time';

export interface SendScheduledAnnouncementResult {
  outcome: 'skipped' | 'sent' | 'failed';
  sent: number;
  failed: number;
}

export interface RunDueAnnouncementsSummary {
  due: number;
  sent: number;
  failed: number;
  skipped: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

type AnnouncementRow = { subject: string; body: string; recipientEmails: string };

async function renderAnnouncementHtml(deps: SendAnnouncementDeps, row: AnnouncementRow): Promise<string> {
  const placeholderUnsub = generateUnsubscribeToken(PLACEHOLDER_EMAIL, deps.sessionSecret);
  const unsubscribeUrl = `${deps.appUrl}/api/unsubscribe?token=${placeholderUnsub}`;
  if (deps.renderEmail) {
    return deps.renderEmail(
      deps,
      { subject: row.subject, body: row.body, recipientEmails: JSON.parse(row.recipientEmails) },
      unsubscribeUrl,
    );
  }
  return render(
    createElement(AnnouncementEmail, {
      subject: row.subject,
      body: row.body,
      appName: deps.config.from.name,
      themeId: deps.config.theme,
      appearance: deps.config.appearance,
      unsubscribeUrl,
    }),
  );
}

function markFailed(deps: SendAnnouncementDeps, id: string, message: string): void {
  deps.db.update(announcements)
    .set({ status: 'failed', error: message, sentAt: new Date() })
    .where(eq(announcements.id, id))
    .run();
}

/**
 * Claims and sends a single due announcement. Never throws: any failure
 * (render error, zero deliverable recipients, delivery error) is recorded on
 * the row as a `failed` status so one bad row can never take down the batch.
 */
export async function sendScheduledAnnouncement(
  deps: SendAnnouncementDeps,
  id: string,
): Promise<SendScheduledAnnouncementResult> {
  // Atomic claim: only a row still `scheduled` transitions to `sending`. If
  // zero rows changed, another tick (or a racing edit/cancel) already
  // handled this id — this is the only concurrency guard the runner needs.
  const claim = deps.db.update(announcements)
    .set({ status: 'sending' })
    .where(and(eq(announcements.id, id), eq(announcements.status, 'scheduled')))
    .run();
  if (claim.changes === 0) {
    return { outcome: 'skipped', sent: 0, failed: 0 };
  }

  const [row] = deps.db.select().from(announcements).where(eq(announcements.id, id)).all();

  let html: string;
  try {
    html = await renderAnnouncementHtml(deps, row);
  } catch (e) {
    const message = errorMessage(e);
    log.error({ err: e, announcementId: id }, 'scheduled announcement render failed');
    markFailed(deps, id, message);
    return { outcome: 'failed', sent: 0, failed: 0 };
  }

  const recipientEmails: string[] = JSON.parse(row.recipientEmails);
  const deliverable = new Set(selectDeliverableRecipients(deps.db, 'announcements').map(r => r.email));
  const targets = recipientEmails.filter(email => deliverable.has(email));

  if (targets.length === 0) {
    markFailed(deps, id, NO_DELIVERABLE_RECIPIENTS_ERROR);
    return { outcome: 'failed', sent: 0, failed: 0 };
  }

  const { sent, failed } = await deliverAnnouncement(deps, {
    announcementId: id,
    subject: row.subject,
    body: row.body,
    recipientEmails: targets,
    html,
  });

  return { outcome: sent === 0 ? 'failed' : 'sent', sent, failed };
}

/**
 * Sends every scheduled announcement whose `scheduledAt` has passed,
 * sequentially and in `scheduledAt` order. Exceptions from an individual
 * send are already contained by `sendScheduledAnnouncement`; this only logs
 * a batch summary.
 */
export async function runDueAnnouncements(
  deps: SendAnnouncementDeps,
  now: Date = new Date(),
): Promise<RunDueAnnouncementsSummary> {
  const dueRows = deps.db.select({ id: announcements.id }).from(announcements)
    .where(and(eq(announcements.status, 'scheduled'), lte(announcements.scheduledAt, now)))
    .orderBy(asc(announcements.scheduledAt))
    .all();

  const summary = { due: dueRows.length, sent: 0, failed: 0, skipped: 0 };
  for (const { id } of dueRows) {
    const result = await sendScheduledAnnouncement(deps, id);
    if (result.outcome === 'sent') summary.sent += 1;
    else if (result.outcome === 'failed') summary.failed += 1;
    else summary.skipped += 1;
  }

  log.info(summary, 'scheduled announcements run complete');
  return summary;
}
