import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import { auth } from '@/kernel/auth/auth';

export const dynamic = 'force-dynamic';

async function isAuthorized(req: Request): Promise<boolean> {
  const ctx = getAppContext();
  if (ctx.env.AUTH_MODE === 'forward') {
    return Boolean(req.headers.get(ctx.env.AUTH_FORWARD_HEADER));
  }
  const bearer = req.headers.get('authorization');
  if (bearer && ctx.env.DIGEST_RUN_TOKEN) {
    if (bearer === `Bearer ${ctx.env.DIGEST_RUN_TOKEN}`) return true;
  }
  const session = await auth();
  return Boolean(session?.user);
}

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = getAppContext();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const dryRun = body.dry_run === true;
  try {
    const result = await runDigest({
      db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, resend: ctx.resend,
      config: ctx.config.newsletter,
      appUrl: ctx.env.APP_URL, sessionSecret: ctx.env.SESSION_SECRET,
      scheduledAt: new Date(), dryRun,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
