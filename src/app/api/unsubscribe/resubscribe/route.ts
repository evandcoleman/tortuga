import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { verifyPreferencesToken, preferencesUrl } from '@/kernel/email/preferences-token';
import { recipientsCache } from '@/modules/newsletter/schema';
import { setCategory, type MessageCategory } from '@/modules/preferences/repo';
import { htmlPage } from '../page-template';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: readonly MessageCategory[] = ['digest', 'announcements'];

function badRequest(message: string) {
  return new NextResponse(htmlPage('Link no longer valid', `<p>${message}</p>`), {
    status: 400, headers: { 'content-type': 'text/html' },
  });
}

function categoryLabel(category: MessageCategory): string {
  return category === 'digest' ? 'the weekly digest' : 'announcements';
}

/**
 * POST-only (GET-safe against link-prefetching mail/browser clients) toggle
 * of a single preference category, driven by the small form on the
 * unsubscribe confirmation page. Verifies a reusable preferences token
 * (never the one-shot unsubscribe token) and refuses to change anything for
 * a hard-suppressed recipient so a stale resubscribe link can't self-revive
 * a bounce/complaint suppression.
 */
export async function POST(req: Request) {
  const ctx = getAppContext();
  const formData = await req.formData();
  const token = String(formData.get('token') ?? '');
  const categoryRaw = String(formData.get('category') ?? '');
  const enabledRaw = String(formData.get('enabled') ?? '');

  const verified = verifyPreferencesToken(token, ctx.env.SESSION_SECRET);
  if (!verified) return badRequest('This preferences link is invalid or has expired.');
  if (!VALID_CATEGORIES.includes(categoryRaw as MessageCategory)) {
    return badRequest('Unknown preference category.');
  }
  const category = categoryRaw as MessageCategory;
  const enabled = enabledRaw === 'true';

  const recipient = ctx.db.select().from(recipientsCache)
    .where(eq(recipientsCache.email, verified.email)).get();
  if (recipient && !recipient.active) {
    return new NextResponse(
      htmlPage('Unable to update', '<p>Email to this address was disabled after a delivery problem. Contact the server admin to restore it.</p>'),
      { status: 403, headers: { 'content-type': 'text/html' } },
    );
  }

  setCategory(ctx.db, verified.email, category, enabled);

  const manageUrl = preferencesUrl(ctx.env.APP_URL, verified.email, ctx.env.SESSION_SECRET);
  const message = enabled
    ? `You're resubscribed to ${categoryLabel(category)}.`
    : `You're unsubscribed from ${categoryLabel(category)}.`;
  return new NextResponse(
    htmlPage('Preferences updated', `<p>${message}</p><p style="margin-top:16px"><a href="${manageUrl}">Manage preferences</a></p>`),
    { headers: { 'content-type': 'text/html' } },
  );
}
