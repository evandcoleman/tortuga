'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { writeConfigOverride } from '@/kernel/config/overrides';

export async function savePreviewDefault(themeId: string, layoutId: string): Promise<void> {
  const ctx = getAppContext();
  writeConfigOverride(ctx.db, { ...ctx.config.newsletter, theme: themeId, layout: layoutId });
  await invalidateAppContext();
  revalidatePath('/newsletter/preview');
  revalidatePath('/settings');
  revalidatePath('/');
}
