'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeConfigOverride, clearConfigOverride } from '@/kernel/config/overrides';
import { createEmailProvider } from '@/kernel/email/factory';
import {
  testTautulli,
  testTmdb,
  testEmailProvider,
  type ConnectionTestsResult,
} from '@/kernel/integrations/connection-tests';
import { parseNewsletterForm } from './form-parse';

export type SaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errors: Record<string, string> };

export async function saveSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdminSession();

  const result = parseNewsletterForm(formData);
  if (!result.ok) return { status: 'error', errors: result.errors };

  const ctx = getAppContext();
  writeConfigOverride(ctx.db, result.config);
  await invalidateAppContext();

  revalidatePath('/settings');
  revalidatePath('/');
  return { status: 'success' };
}

/**
 * Run live connectivity checks against the configured integrations. Uses the
 * clients already wired into the AppContext so it reflects current config.
 * Each check is isolated: one failure never blocks the others, and all error
 * details are sanitized inside the test helpers before reaching the UI.
 */
export async function testConnections(): Promise<ConnectionTestsResult> {
  await requireAdminSession();

  const ctx = getAppContext();
  const [tautulli, tmdb] = await Promise.all([
    testTautulli(ctx.tautulli),
    testTmdb(ctx.tmdb),
  ]);
  const email = testEmailProvider(() =>
    createEmailProvider(ctx.env, ctx.config.newsletter.email),
  );
  return { tautulli, tmdb, email };
}

export async function revertToFileDefault(): Promise<void> {
  await requireAdminSession();

  const ctx = getAppContext();
  clearConfigOverride(ctx.db);
  await invalidateAppContext();
  revalidatePath('/settings');
  revalidatePath('/');
}
