'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { writeConfigOverride, clearConfigOverride } from '@/kernel/config/overrides';
import { parseNewsletterForm } from './form-parse';

export type SaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errors: Record<string, string> };

export async function saveSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const result = parseNewsletterForm(formData);
  if (!result.ok) return { status: 'error', errors: result.errors };

  const ctx = getAppContext();
  writeConfigOverride(ctx.db, result.config);
  await invalidateAppContext();

  revalidatePath('/settings');
  revalidatePath('/');
  return { status: 'success' };
}

export async function revertToFileDefault(): Promise<void> {
  const ctx = getAppContext();
  clearConfigOverride(ctx.db);
  await invalidateAppContext();
  revalidatePath('/settings');
  revalidatePath('/');
}
