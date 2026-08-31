import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { verifyUnsubscribeToken } from '@/kernel/email/unsubscribe';
import { recipientsCache, unsubscribes } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

const ALREADY_USED_RESPONSE = () => new NextResponse(
  htmlPage('Link no longer valid', 'This unsubscribe link is invalid or has been used.'),
  { status: 400, headers: { 'content-type': 'text/html' } },
);

/**
 * Verifies the token and atomically claims it (only the request that flips
 * `usedAt` from NULL wins, guarding against a TOCTOU race between two
 * concurrent requests for the same link — better-sqlite3 executes this
 * synchronously, so there's no window for another request to interleave
 * between the check and the write). On success, deactivates the recipient.
 * Returns `null` on success, or the failure reason otherwise.
 */
function claimUnsubscribeToken(
  ctx: ReturnType<typeof getAppContext>,
  token: string,
): 'invalid' | 'already-used' | null {
  const verified = verifyUnsubscribeToken(token, ctx.env.SESSION_SECRET);
  if (!verified) return 'invalid';

  const claim = ctx.db.update(unsubscribes).set({ usedAt: new Date() })
    .where(and(eq(unsubscribes.token, token), isNull(unsubscribes.usedAt)))
    .run();
  if (claim.changes === 0) return 'already-used';

  ctx.db.update(recipientsCache).set({ active: false })
    .where(eq(recipientsCache.email, verified.email)).run();
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const ctx = getAppContext();
  const failure = claimUnsubscribeToken(ctx, token);
  if (failure) return ALREADY_USED_RESPONSE();

  return new NextResponse(htmlPage("You're unsubscribed", 'You will no longer receive the newsletter.'), {
    headers: { 'content-type': 'text/html' },
  });
}

/**
 * RFC 8058 one-click unsubscribe: mail clients POST
 * `List-Unsubscribe=One-Click` with no user interaction and expect a bare
 * 200 (no confirmation page / redirect) on success.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const ctx = getAppContext();
  const failure = claimUnsubscribeToken(ctx, token);
  if (failure) {
    return new NextResponse(null, { status: 400 });
  }

  return new NextResponse(null, { status: 200 });
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e7e9ee;min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{max-width:480px;background:#181c25;border-radius:12px;padding:32px}
  h1{margin:0 0 12px 0;font-size:22px}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}
