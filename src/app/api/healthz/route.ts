import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

// Cap stored digest errors so a full stack trace can't bloat the health payload.
const MAX_ERROR_LENGTH = 500;

interface SchedulerJob {
  name: string;
  cron: string;
  // croner's nextRun() returns null when the job is stopped or has no future run.
  nextRun: string | null;
}

interface LastDigest {
  status: string;
  scheduledAt: string;
  error: string | null;
}

export async function GET() {
  const checks: Record<string, string> = {};
  const ts = new Date().toISOString();
  try {
    const ctx = getAppContext();

    try { ctx.db.$client.prepare('select 1').all(); checks.db = 'ok'; }
    catch { checks.db = 'fail'; }

    try { await ctx.tautulli.getUsers(); checks.tautulli = 'ok'; }
    catch { checks.tautulli = 'fail'; }

    // Email provider is instantiated but not pinged — just report its name.
    const emailProvider = ctx.email.name;

    const jobs: SchedulerJob[] = ctx.scheduler.list().map(job => ({
      name: job.name,
      cron: job.cron,
      nextRun: job.nextRun ? job.nextRun.toISOString() : null,
    }));

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
          error: lastDigestRow.error ? lastDigestRow.error.slice(0, MAX_ERROR_LENGTH) : null,
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
        jobs,
      },
      last_digest: lastDigest,
    };

    return NextResponse.json(body, { status: coreFailed ? 503 : 200 });
  } catch (err) {
    return NextResponse.json({ status: 'fail', ts, error: String(err) }, { status: 500 });
  }
}
