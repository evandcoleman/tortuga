'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeConfigOverride } from '@/kernel/config/overrides';
import { digests, sends } from '@/modules/newsletter/schema';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import {
  renderAndSendTestDigest,
  type TestDigestResult,
} from '@/modules/newsletter/pipeline/test-digest';

/**
 * Result of a manual "Send now" run. Mirrors what runDigest returns but also
 * exposes how many recipients actually received the email — runDigest does not
 * track that, so the action counts 'sent' rows from the sends table afterward.
 */
export type SendNowResult =
  | { success: true; id: string; status: 'sent' | 'failed' | 'skipped' | 'rendered'; itemCount: number; sentCount: number }
  | { success: false; error: string };

/**
 * Trigger a real (non-dry-run) digest run that emails every active recipient.
 *
 * Optionally overrides the theme/layout for THIS run only (so admins can send
 * the combo currently selected in the preview switcher) without persisting it
 * as the saved default. Errors from runDigest — including a provider outage
 * mid-send — are caught and returned as a structured failure so the caller can
 * surface them in the UI rather than throwing a 500. Note: a 'failed' status
 * with a non-zero sentCount means the send was partial.
 */
export async function sendNowDigest(themeId?: string, layoutId?: string): Promise<SendNowResult> {
  await requireAdminSession();

  const ctx = getAppContext();
  const newsletter =
    themeId && layoutId
      ? { ...ctx.config.newsletter, theme: themeId, layout: layoutId }
      : ctx.config.newsletter;

  try {
    const result = await runDigest({
      db: ctx.db,
      tautulli: ctx.tautulli,
      tmdb: ctx.tmdb,
      maintainerr: ctx.maintainerr,
      provider: ctx.email,
      llm: ctx.llm,
      config: newsletter,
      appUrl: ctx.env.APP_URL,
      sessionSecret: ctx.env.SESSION_SECRET,
      scheduledAt: new Date(),
    });

    const sentCount = ctx.db
      .select()
      .from(sends)
      .where(and(eq(sends.digestId, result.id), eq(sends.status, 'sent')))
      .all().length;

    revalidatePath('/newsletter/preview');
    revalidatePath('/newsletter/history');
    revalidatePath('/');

    return {
      success: true,
      id: result.id,
      status: result.status,
      itemCount: result.itemCount,
      sentCount,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Digest run failed.' };
  }
}

export async function savePreviewDefault(themeId: string, layoutId: string): Promise<void> {
  await requireAdminSession();

  const ctx = getAppContext();
  writeConfigOverride(ctx.db, { ...ctx.config.newsletter, theme: themeId, layout: layoutId });
  await invalidateAppContext();
  revalidatePath('/newsletter/preview');
  revalidatePath('/settings');
  revalidatePath('/');
}

export async function sendTestDigest(
  themeId: string,
  layoutId: string,
  toEmail: string,
): Promise<TestDigestResult> {
  await requireAdminSession();

  const ctx = getAppContext();
  const latest = ctx.db
    .select()
    .from(digests)
    .where(eq(digests.status, 'rendered'))
    .orderBy(desc(digests.scheduledAt))
    .limit(1)
    .all();
  const row = latest[0];
  if (!row) {
    return { success: false, error: 'No preview available — generate a fresh preview first.' };
  }

  return renderAndSendTestDigest({
    digestId: row.id,
    themeId,
    layoutId,
    toEmail,
    subject: row.renderedSubject ?? `New on ${ctx.config.newsletter.from.name}`,
    provider: ctx.email,
    from: ctx.config.newsletter.from,
    replyTo: ctx.config.newsletter.reply_to,
  });
}
