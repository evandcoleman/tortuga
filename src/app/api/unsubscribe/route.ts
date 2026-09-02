import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { verifyUnsubscribeToken } from '@/kernel/email/unsubscribe';
import { mintPreferencesToken, preferencesUrl } from '@/kernel/email/preferences-token';
import { unsubscribes } from '@/modules/newsletter/schema';
import { setCategory, type MessageCategory } from '@/modules/preferences/repo';
import { htmlPage } from './page-template';

export const dynamic = 'force-dynamic';

const ALREADY_USED_RESPONSE = () => new NextResponse(
  htmlPage('Link no longer valid', '<p>This unsubscribe link is invalid or has been used.</p>'),
  { status: 400, headers: { 'content-type': 'text/html' } },
);

interface ClaimResult {
  email: string;
  category: MessageCategory;
}

/**
 * Verifies the token and atomically claims it (only the request that flips
 * `usedAt` from NULL wins, guarding against a TOCTOU race between two
 * concurrent requests for the same link — better-sqlite3 executes this
 * synchronously, so there's no window for another request to interleave
 * between the check and the write). On success, opts the recipient out of
 * the token's category only — `active` is untouched; only hard suppression
 * (bounce/complaint/admin) sets that.
 */
function claimUnsubscribeToken(
  ctx: ReturnType<typeof getAppContext>,
  token: string,
): ClaimResult | 'invalid' | 'already-used' {
  const verified = verifyUnsubscribeToken(token, ctx.env.SESSION_SECRET);
  if (!verified) return 'invalid';

  const row = ctx.db.select().from(unsubscribes).where(eq(unsubscribes.token, token)).get();
  if (!row) return 'invalid';

  const claim = ctx.db.update(unsubscribes).set({ usedAt: new Date() })
    .where(and(eq(unsubscribes.token, token), isNull(unsubscribes.usedAt)))
    .run();
  if (claim.changes === 0) return 'already-used';

  setCategory(ctx.db, verified.email, row.category, false);
  return { email: verified.email, category: row.category };
}

function categoryLabel(category: MessageCategory): string {
  return category === 'digest' ? 'the weekly digest' : 'announcements';
}

function otherCategory(category: MessageCategory): MessageCategory {
  return category === 'digest' ? 'announcements' : 'digest';
}

function resubscribeForm(prefsToken: string, category: MessageCategory, enabled: boolean, label: string): string {
  return `<form method="POST" action="/api/unsubscribe/resubscribe">
    <input type="hidden" name="token" value="${prefsToken}">
    <input type="hidden" name="category" value="${category}">
    <input type="hidden" name="enabled" value="${enabled}">
    <button type="submit">${label}</button>
  </form>`;
}

function confirmationBody(ctx: ReturnType<typeof getAppContext>, result: ClaimResult): string {
  const prefsToken = mintPreferencesToken(result.email, ctx.env.SESSION_SECRET);
  const other = otherCategory(result.category);
  const manageUrl = preferencesUrl(ctx.env.APP_URL, result.email, ctx.env.SESSION_SECRET);
  return `
    <p>You're unsubscribed from ${categoryLabel(result.category)}.</p>
    ${resubscribeForm(prefsToken, result.category, true, 'Resubscribe')}
    ${resubscribeForm(prefsToken, other, false, `Also stop ${categoryLabel(other)}`)}
    <p style="margin-top:16px"><a href="${manageUrl}">Manage preferences</a></p>
  `;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const ctx = getAppContext();
  const result = claimUnsubscribeToken(ctx, token);
  if (result === 'invalid' || result === 'already-used') return ALREADY_USED_RESPONSE();

  return new NextResponse(htmlPage("You're unsubscribed", confirmationBody(ctx, result)), {
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
  const result = claimUnsubscribeToken(ctx, token);
  if (result === 'invalid' || result === 'already-used') {
    return new NextResponse(null, { status: 400 });
  }

  return new NextResponse(null, { status: 200 });
}
