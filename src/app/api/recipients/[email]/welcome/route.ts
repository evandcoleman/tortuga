import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { recipientsCache } from '@/modules/newsletter/schema';
import { sendWelcomeEmail } from '@/modules/invites/send-welcome';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ email: string }>;
}

/**
 * Manually sends the welcome email to an existing recipient, regardless of
 * whether they have an `invites` row (covers users invited outside Tortuga
 * — flagged "not welcomed" by the Tautulli sync). Never auto-triggered.
 */
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

  const recipient = ctx.db.select().from(recipientsCache).where(eq(recipientsCache.email, decoded)).get();
  if (!recipient) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!recipient.active) {
    return NextResponse.json({ error: `${decoded} is deactivated and cannot be sent a welcome email.` }, { status: 409 });
  }

  const result = await sendWelcomeEmail(
    { db: ctx.db, provider: ctx.email, config: ctx.config.newsletter },
    { email: decoded, name: recipient.name },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  ctx.db.update(recipientsCache).set({ welcomedAt: new Date() }).where(eq(recipientsCache.email, decoded)).run();
  return NextResponse.json({ status: 'sent' });
}
