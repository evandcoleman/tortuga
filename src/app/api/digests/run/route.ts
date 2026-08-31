import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import { auth } from '@/kernel/auth/auth';
import { createLogger } from '@/kernel/logging/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api.digests.run');

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
      db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, maintainerr: ctx.maintainerr, provider: ctx.email, llm: ctx.llm,
      config: ctx.config.newsletter,
      appUrl: ctx.env.APP_URL, sessionSecret: ctx.env.SESSION_SECRET,
      scheduledAt: new Date(), dryRun,
    });
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err }, 'digest run failed');
    return NextResponse.json({ error: 'digest run failed' }, { status: 500 });
  }
}
