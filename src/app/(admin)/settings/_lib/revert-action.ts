'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { clearConfigOverride } from '@/kernel/config/overrides';

/** Discards the DB config override for the whole newsletter config (all settings pages), reverting to the YAML file default. */
export async function revertToFileDefault(): Promise<void> {
  await requireAdminSession();

  const ctx = getAppContext();
  clearConfigOverride(ctx.db, 'newsletter');
  await invalidateAppContext();
  revalidatePath('/settings', 'layout');
  revalidatePath('/');
}
