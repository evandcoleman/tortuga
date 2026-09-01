'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeConfigOverride, clearConfigOverride } from '@/kernel/config/overrides';
import { validatePortalConfig } from './validate';

export type SaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errors: Record<string, string> };

/**
 * Validates and persists the whole `portal` config section. Unlike the
 * newsletter settings pages, the portal section is edited on a single page,
 * so `candidate` is the full `PortalConfig` shape rather than a patch merged
 * onto other pages' fields.
 */
export async function savePortalSettings(_prev: SaveState, candidate: unknown): Promise<SaveState> {
  await requireAdminSession();

  const result = validatePortalConfig(candidate);
  if (!result.ok) return { status: 'error', errors: result.errors };

  const ctx = getAppContext();
  writeConfigOverride(ctx.db, 'portal', result.config);
  await invalidateAppContext();

  revalidatePath('/settings/portal');
  revalidatePath('/portal');
  return { status: 'success' };
}

/** Discards the DB config override for the portal section, reverting to the YAML file default. */
export async function revertPortalSettings(): Promise<void> {
  await requireAdminSession();

  const ctx = getAppContext();
  clearConfigOverride(ctx.db, 'portal');
  await invalidateAppContext();

  revalidatePath('/settings/portal');
  revalidatePath('/portal');
}
