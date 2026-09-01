import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { recipientsCache } from '@/modules/newsletter/schema';
import { eq } from 'drizzle-orm';
import { getInviteByEmail, markWelcomeSent, upsertInviteAfterPlexInvite } from '@/modules/invites/service';
import { sendWelcomeEmail } from '@/modules/invites/send-welcome';
import type { PlexClient } from '@/kernel/integrations/plex';

export const dynamic = 'force-dynamic';

async function isPendingOnPlex(plex: PlexClient, email: string): Promise<boolean> {
  const pending = await plex.getPendingInvites();
  if (!pending.ok) return false;
  return pending.data.some(p => p.invitedEmail.toLowerCase() === email.toLowerCase());
}

interface RouteParams {
  params: Promise<{ email: string }>;
}

/** Resends the welcome email for an existing invite (used after `invited_welcome_failed` or on demand). */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const ctx = getAppContext();
  if (!ctx.email) {
    return NextResponse.json({ error: 'No email provider is configured' }, { status: 409 });
  }

  let invite = getInviteByEmail(ctx.db, decoded);
  if (!invite) {
    const foundOnPlex = ctx.plex ? await isPendingOnPlex(ctx.plex, decoded) : false;
    if (!foundOnPlex) {
      return NextResponse.json({ error: "invite not found locally or on plex.tv" }, { status: 404 });
    }
    invite = upsertInviteAfterPlexInvite(ctx.db, decoded, []);
  }

  const recipient = ctx.db.select().from(recipientsCache).where(eq(recipientsCache.email, decoded)).get();
  if (recipient && !recipient.active) {
    return NextResponse.json({ error: `${decoded} is deactivated and cannot be sent a welcome email.` }, { status: 409 });
  }

  const result = await sendWelcomeEmail(
    { db: ctx.db, provider: ctx.email, config: ctx.config.newsletter },
    { email: decoded, name: recipient?.name ?? null },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  markWelcomeSent(ctx.db, decoded);
  if (recipient) {
    ctx.db.update(recipientsCache).set({ welcomedAt: new Date() }).where(eq(recipientsCache.email, decoded)).run();
  }
  return NextResponse.json({ status: 'sent' });
}
