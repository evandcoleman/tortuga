'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { alerts } from '@/modules/alerts/schema';

const idSchema = z.string().trim().min(1, 'Invalid alert id');

export type AcknowledgeAlertResult = { success: true } | { success: false; error: string };

function revalidateAlertPaths(): void {
  revalidatePath('/');
  revalidatePath('/alerts');
}

/** Acknowledges a single open alert. No-op (but still succeeds) if it was already acknowledged. */
export async function acknowledgeAlert(id: string): Promise<AcknowledgeAlertResult> {
  await requireAdminSession();

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid alert id' };
  }

  const ctx = getAppContext();
  ctx.db
    .update(alerts)
    .set({ acknowledgedAt: new Date() })
    .where(and(eq(alerts.id, parsed.data), isNull(alerts.acknowledgedAt)))
    .run();

  revalidateAlertPaths();
  return { success: true };
}

/** Acknowledges every currently-open alert. Already-acknowledged rows are left untouched. */
export async function acknowledgeAllAlerts(): Promise<AcknowledgeAlertResult> {
  await requireAdminSession();

  const ctx = getAppContext();
  ctx.db
    .update(alerts)
    .set({ acknowledgedAt: new Date() })
    .where(isNull(alerts.acknowledgedAt))
    .run();

  revalidateAlertPaths();
  return { success: true };
}
