'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { createLogger } from '@/kernel/logging/logger';
import {
  addManualRecipient,
  removeRecipient as removeRecipientFromDb,
  importManualRecipients,
} from '@/modules/newsletter/pipeline/recipients';
import {
  recipientSchema,
  removeSchema,
  parseRecipientsCsv,
  deriveNameFromEmail,
} from './schema';

const log = createLogger('recipients.actions');

export type ActionResult =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; error: string };

const RECIPIENTS_PATH = '/newsletter/recipients';

function revalidateRecipients(): void {
  revalidatePath(RECIPIENTS_PATH);
  revalidatePath('/');
}

/** Add (or reactivate) a single manual recipient from a form submission. */
export async function addRecipient(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminSession();

  const parsed = recipientSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { email, name } = parsed.data;
  try {
    const ctx = getAppContext();
    const { created, reactivated } = addManualRecipient(
      ctx.db,
      email,
      name ?? deriveNameFromEmail(email),
    );
    await invalidateAppContext();
    revalidateRecipients();
    const message = created
      ? `Added ${email}`
      : reactivated
        ? `Re-activated ${email}`
        : `Updated ${email}`;
    return { status: 'success', message };
  } catch (err: unknown) {
    log.error({ err }, 'failed to add recipient');
    return { status: 'error', error: 'Could not add recipient. Please try again.' };
  }
}

/** Soft-delete a recipient (active=false). Invoked from the per-row remove button. */
export async function removeRecipient(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminSession();

  const parsed = removeSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', error: 'Invalid recipient' };
  }

  try {
    const ctx = getAppContext();
    const { removed } = removeRecipientFromDb(ctx.db, parsed.data.email);
    if (!removed) {
      return { status: 'error', error: 'Recipient not found' };
    }
    await invalidateAppContext();
    revalidateRecipients();
    return { status: 'success', message: `Removed ${parsed.data.email}` };
  } catch (err: unknown) {
    log.error({ err }, 'failed to remove recipient');
    return { status: 'error', error: 'Could not remove recipient. Please try again.' };
  }
}

/** Bulk-import newline/comma-separated recipients from the import textarea. */
export async function importRecipientsCsv(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminSession();

  const raw = formData.get('csv');
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { status: 'error', error: 'Paste at least one email address' };
  }

  const { entries, invalid, duplicates } = parseRecipientsCsv(raw);
  if (entries.length === 0) {
    return {
      status: 'error',
      error:
        invalid.length > 0
          ? `No valid emails found. Check: ${invalid.slice(0, 3).join(', ')}`
          : 'No valid emails found',
    };
  }

  try {
    const ctx = getAppContext();
    const result = importManualRecipients(ctx.db, entries);
    await invalidateAppContext();
    revalidateRecipients();

    const parts = [`Imported ${result.added}`];
    if (result.reactivated > 0) parts.push(`re-activated ${result.reactivated}`);
    if (result.skippedExisting > 0) parts.push(`skipped ${result.skippedExisting} existing`);
    if (duplicates.length > 0) parts.push(`deduped ${duplicates.length}`);
    if (invalid.length > 0) parts.push(`ignored ${invalid.length} invalid`);
    return { status: 'success', message: parts.join(', ') };
  } catch (err: unknown) {
    log.error({ err }, 'failed to import recipients');
    return { status: 'error', error: 'Could not import recipients. Please try again.' };
  }
}
