import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { recipientsCache } from '@/modules/newsletter/schema';
import { eq } from 'drizzle-orm';
import { getInviteByEmail, markWelcomeSent } from '@/modules/invites/service';
import { sendWelcomeEmail } from '@/modules/invites/send-welcome';

export const dynamic = 'force-dynamic';

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

  const invite = getInviteByEmail(ctx.db, decoded);
  if (!invite) return NextResponse.json({ error: 'not found' }, { status: 404 });

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
