import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

/**
 * This endpoint is unauthenticated (hit by monitoring/uptime checks). It
 * therefore only ever reports coarse status and timestamps — no raw error
 * text and no scheduler job names/crons, which would otherwise leak internal
 * implementation details to anyone who can reach the route.
 */

interface LastDigest {
  status: string;
  scheduledAt: string;
}

export async function GET() {
  const checks: Record<string, string> = {};
  const ts = new Date().toISOString();
  try {
    const ctx = getAppContext();

    try { ctx.db.$client.prepare('select 1').all(); checks.db = 'ok'; }
    catch { checks.db = 'fail'; }

    if (!ctx.tautulli) {
      checks.tautulli = 'fail';
    } else {
      try { await ctx.tautulli.getUsers(); checks.tautulli = 'ok'; }
      catch { checks.tautulli = 'fail'; }
    }

    // Email provider is instantiated but not pinged — just report its name (or null if unconfigured).
    const emailProvider = ctx.email?.name ?? null;

    // Job count only — names and cron expressions are internal scheduling
    // details, not something an unauthenticated caller needs.
    const jobCount = ctx.scheduler.list().length;

    const lastDigestRow = ctx.db
      .select()
      .from(digests)
      .orderBy(desc(digests.scheduledAt))
      .limit(1)
      .all()[0];

    const lastDigest: LastDigest | null = lastDigestRow
      ? {
          status: lastDigestRow.status,
          scheduledAt: lastDigestRow.scheduledAt.toISOString(),
        }
      : null;

    // Core checks fail → 503. Only digest status 'failed' degrades; transient
    // states ('pending'|'rendered'|'sending') and 'skipped'/'sent' are healthy.
    const coreFailed = Object.values(checks).some(v => v === 'fail');
    const lastDigestFailed = lastDigestRow?.status === 'failed';
    const status = coreFailed ? 'fail' : lastDigestFailed ? 'degraded' : 'ok';

    const body = {
      status,
      ts,
      ...checks,
      email_provider: emailProvider,
      scheduler: {
        schedule_enabled: ctx.config.newsletter.schedule_enabled,
        job_count: jobCount,
      },
      last_digest: lastDigest,
    };

    return NextResponse.json(body, { status: coreFailed ? 503 : 200 });
  } catch (err) {
    return NextResponse.json({ status: 'fail', ts, error: String(err) }, { status: 500 });
  }
}
