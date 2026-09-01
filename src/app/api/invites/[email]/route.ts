import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { createLogger } from '@/kernel/logging/logger';
import { getInviteByEmail, markInviteCancelled } from '@/modules/invites/service';

export const dynamic = 'force-dynamic';

const log = createLogger('api.invites.email');

interface RouteParams {
  params: Promise<{ email: string }>;
}

/** Cancels a pending invite: revokes it on plex.tv (if still found there) and marks the local row cancelled. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const ctx = getAppContext();
  const invite = getInviteByEmail(ctx.db, decoded);

  let matchedOnPlex = false;
  if (ctx.plex) {
    const pending = await ctx.plex.getPendingInvites();
    if (pending.ok) {
      const match = pending.data.find(p => p.invitedEmail.toLowerCase() === decoded.toLowerCase());
      if (match) {
        matchedOnPlex = true;
        const cancelled = await ctx.plex.cancelInvite(match);
        if (!cancelled.ok) {
          log.error({ error: cancelled.error, email: decoded }, 'failed to cancel plex invite');
          return NextResponse.json({ error: cancelled.error.message }, { status: 502 });
        }
      }
    }
  }

  if (!invite && !matchedOnPlex) {
    return NextResponse.json({ error: "invite not found locally or on plex.tv" }, { status: 404 });
  }

  if (invite) {
    markInviteCancelled(ctx.db, decoded);
  }
  return NextResponse.json({ status: 'cancelled' });
}
