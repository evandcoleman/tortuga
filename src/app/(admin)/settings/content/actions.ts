'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeConfigOverride } from '@/kernel/config/overrides';
import { parseContentForm } from './form-parse';

export type SaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errors: Record<string, string> };

export async function saveContentSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdminSession();

  const ctx = getAppContext();
  const result = parseContentForm(formData, ctx.config.newsletter);
  if (!result.ok) return { status: 'error', errors: result.errors };

  writeConfigOverride(ctx.db, 'newsletter', result.config);
  await invalidateAppContext();

  revalidatePath('/settings/content');
  revalidatePath('/');
  return { status: 'success' };
}
