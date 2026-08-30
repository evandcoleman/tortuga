'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { recipientsCache } from '@/modules/newsletter/schema';
import { sendAnnouncement } from '@/modules/announcements/pipeline/send';

const subjectSchema = z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or fewer');
const bodySchema = z.string().trim().min(1, 'Body is required').max(20000, 'Body must be 20,000 characters or fewer');
const emailSchema = z.string().email('Enter a valid email address');

const previewSchema = z.object({
  subject: subjectSchema,
  body: bodySchema,
});

const sendTestSchema = z.object({
  subject: subjectSchema,
  body: bodySchema,
});

const sendSchema = z.object({
  subject: subjectSchema,
  body: bodySchema,
  recipientEmails: z.array(emailSchema).min(1, 'Select at least one recipient'),
});

export type PreviewResult =
  | { success: true; html: string }
  | { success: false; error: string };

export type SendTestResult =
  | { success: true; sent: number; failed: number }
  | { success: false; error: string };

export type SendResult =
  | { success: true; announcementId: string; sent: number; failed: number }
  | { success: false; error: string };

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

function activeRecipientEmails(): Set<string> {
  const ctx = getAppContext();
  return new Set(
    ctx.db
      .select()
      .from(recipientsCache)
      .all()
      .filter(r => r.active)
      .map(r => r.email),
  );
}

/** Render the announcement as a dry-run — no announcement row, no sends. */
export async function previewAnnouncement(subject: string, body: string): Promise<PreviewResult> {
  await requireAdminSession();

  const parsed = previewSchema.safeParse({ subject, body });
  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  const ctx = getAppContext();
  try {
    const result = await sendAnnouncement(
      {
        db: ctx.db,
        provider: ctx.email,
        config: ctx.config.newsletter,
        appUrl: ctx.env.APP_URL,
        sessionSecret: ctx.env.SESSION_SECRET,
      },
      { subject: parsed.data.subject, body: parsed.data.body, recipientEmails: [], dryRun: true },
    );
    return { success: true, html: result.html };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Preview failed.' };
  }
}

/**
 * Send a single test copy to the signed-in admin. The recipient is never
 * client-controllable: it's resolved from the authenticated session, falling
 * back to ADMIN_EMAIL when the session carries no email (e.g. forward mode).
 */
export async function sendTestAnnouncement(subject: string, body: string): Promise<SendTestResult> {
  const identity = await requireAdminSession();

  const parsed = sendTestSchema.safeParse({ subject, body });
  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  const ctx = getAppContext();
  const testRecipient = identity.email ?? ctx.env.ADMIN_EMAIL ?? null;
  if (!testRecipient) {
    return { success: false, error: 'No admin email available for test send' };
  }

  try {
    const result = await sendAnnouncement(
      {
        db: ctx.db,
        provider: ctx.email,
        config: ctx.config.newsletter,
        appUrl: ctx.env.APP_URL,
        sessionSecret: ctx.env.SESSION_SECRET,
      },
      {
        subject: parsed.data.subject,
        body: parsed.data.body,
        recipientEmails: [],
        testRecipient,
      },
    );
    if (result.failed > 0) {
      return { success: false, error: 'Test send failed — check the email provider logs.' };
    }
    return { success: true, sent: result.sent, failed: result.failed };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Test send failed.' };
  }
}

/** Send the announcement to the given recipients. Every address must be an active recipient. */
export async function sendAnnouncementToRecipients(
  subject: string,
  body: string,
  recipientEmails: string[],
): Promise<SendResult> {
  await requireAdminSession();

  const parsed = sendSchema.safeParse({ subject, body, recipientEmails });
  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  const active = activeRecipientEmails();
  const invalid = parsed.data.recipientEmails.filter(email => !active.has(email));
  if (invalid.length > 0) {
    return {
      success: false,
      error: `Not an active recipient: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`,
    };
  }

  const ctx = getAppContext();
  try {
    const result = await sendAnnouncement(
      {
        db: ctx.db,
        provider: ctx.email,
        config: ctx.config.newsletter,
        appUrl: ctx.env.APP_URL,
        sessionSecret: ctx.env.SESSION_SECRET,
      },
      {
        subject: parsed.data.subject,
        body: parsed.data.body,
        recipientEmails: parsed.data.recipientEmails,
      },
    );
    revalidatePath('/messages/history');
    revalidatePath('/');
    if (!result.announcementId) {
      return { success: false, error: 'No active recipients selected.' };
    }
    return { success: true, announcementId: result.announcementId, sent: result.sent, failed: result.failed };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Send failed.' };
  }
}
