import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { createLogger } from '@/kernel/logging/logger';
import { createInvite } from '@/modules/invites/invite-flow';
import { listInvites } from '@/modules/invites/service';

export const dynamic = 'force-dynamic';

const log = createLogger('api.invites');

const createInviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  sectionIds: z.array(z.string().min(1)).min(1, 'Select at least one library'),
});

export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const ctx = getAppContext();
  return NextResponse.json({ invites: listInvites(ctx.db) });
}

export async function POST(req: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const ctx = getAppContext();
  if (!ctx.plex) {
    return NextResponse.json({ error: 'Plex is not configured (set PLEX_TOKEN and newsletter.plex.server_id)' }, { status: 409 });
  }
  if (!ctx.email) {
    return NextResponse.json({ error: 'No email provider is configured' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const result = await createInvite(
    { db: ctx.db, plex: ctx.plex, provider: ctx.email, config: ctx.config.newsletter },
    parsed.data,
  );

  switch (result.status) {
    case 'sent':
      return NextResponse.json({ status: 'sent' }, { status: 201 });
    case 'invited_welcome_failed':
      // Never a rollback: the Plex invite already succeeded. Surface the
      // partial failure so the UI can offer "resend welcome".
      return NextResponse.json(
        { status: 'invited_welcome_failed', welcomeError: result.welcomeError },
        { status: 207 },
      );
    case 'refused':
      if (result.reason === 'suppressed' || result.reason === 'duplicate') {
        return NextResponse.json({ error: result.message }, { status: 409 });
      }
      log.error({ message: result.message }, 'plex invite failed');
      return NextResponse.json({ error: result.message }, { status: 502 });
  }
}
