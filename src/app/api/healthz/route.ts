import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const out: Record<string, string> = { ts: new Date().toISOString() };
  try {
    const ctx = getAppContext();
    try { ctx.db.$client.prepare('select 1').all(); out.db = 'ok'; }
    catch { out.db = 'fail'; }
    try { await ctx.tautulli.getUsers(); out.tautulli = 'ok'; }
    catch { out.tautulli = 'fail'; }
    out.email_provider = ctx.email.name;
    const failed = Object.entries(out).some(([k, v]) => k !== 'ts' && v === 'fail');
    return NextResponse.json(out, { status: failed ? 503 : 200 });
  } catch (err) {
    return NextResponse.json({ ...out, error: String(err) }, { status: 500 });
  }
}
