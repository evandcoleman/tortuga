'use server';

import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { writeConfigOverride } from '@/kernel/config/overrides';
import { digests } from '@/modules/newsletter/schema';
import {
  renderAndSendTestDigest,
  type TestDigestResult,
} from '@/modules/newsletter/pipeline/test-digest';

export async function savePreviewDefault(themeId: string, layoutId: string): Promise<void> {
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
