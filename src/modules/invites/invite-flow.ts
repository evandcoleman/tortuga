import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import type { PlexClient } from '@/kernel/integrations/plex';
import type { EmailProvider } from '@/kernel/email/types';
import { recipientsCache } from '@/modules/newsletter/schema';

import { upsertInviteAfterPlexInvite, markWelcomeSent } from './service';
import { sendWelcomeEmail, type WelcomeEmailConfig } from './send-welcome';

export interface CreateInviteDeps {
  db: Db;
  plex: PlexClient;
  provider: EmailProvider;
  config: WelcomeEmailConfig;
}

export interface CreateInviteInput {
  email: string;
  sectionIds: string[];
}

export type CreateInviteResult =
  | { status: 'sent' }
  | { status: 'invited_welcome_failed'; welcomeError: string }
  | { status: 'refused'; reason: 'suppressed'; message: string }
  | { status: 'refused'; reason: 'duplicate'; message: string }
  | { status: 'refused'; reason: 'plex_error'; message: string };

/**
 * Full invite flow: refuse deactivated addresses -> Plex invite -> upsert
 * the local `invites` row -> render + send the welcome email -> mark
 * `welcomeSentAt`. If the Plex invite succeeds but the email send fails,
 * the invite row is left in place (welcomeSentAt null) and the Plex invite
 * is never rolled back — the caller can retry the welcome email later via
 * "resend welcome".
 */
export async function createInvite(deps: CreateInviteDeps, input: CreateInviteInput): Promise<CreateInviteResult> {
  const recipient = deps.db.select().from(recipientsCache).where(eq(recipientsCache.email, input.email)).get();
  if (recipient && !recipient.active) {
    return {
      status: 'refused',
      reason: 'suppressed',
      message: `${input.email} is deactivated (bounced, complained, or unsubscribed) and cannot be invited.`,
    };
  }

  const plexResult = await deps.plex.invite(input.email, input.sectionIds);
  if (!plexResult.ok) {
    if (plexResult.error.type === 'duplicate') {
      return { status: 'refused', reason: 'duplicate', message: plexResult.error.message };
    }
    return { status: 'refused', reason: 'plex_error', message: plexResult.error.message };
  }

  upsertInviteAfterPlexInvite(deps.db, input.email, input.sectionIds);

  const sendResult = await sendWelcomeEmail(
    { db: deps.db, provider: deps.provider, config: deps.config },
    { email: input.email, name: recipient?.name ?? null },
  );
  if (!sendResult.ok) {
    return { status: 'invited_welcome_failed', welcomeError: sendResult.error };
  }

  markWelcomeSent(deps.db, input.email);
  return { status: 'sent' };
}
