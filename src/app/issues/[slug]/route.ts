import { eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests } from '@/modules/newsletter/schema';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';

export const dynamic = 'force-dynamic';

const NOT_FOUND = new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

/**
 * Serves the immutable web-variant snapshot for a hosted newsletter issue.
 *
 * - 'sent' digests are public: anyone with the (unguessable) slug can view them.
 * - 'rendered' (unsent) digests are admin-only previews — they 404 for
 *   unauthenticated requests rather than 401, so an unauthenticated caller
 *   can't distinguish "unpublished draft" from "unknown slug".
 * - any other status, missing slug, or missing web_html also 404s.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ctx = getAppContext();
  const row = ctx.db.select().from(digests).where(eq(digests.slug, slug)).get();

  if (!row || !row.webHtml) return NOT_FOUND;

  if (row.status === 'rendered') {
    const isAdmin = await requireAdminSession().then(() => true).catch(() => false);
    if (!isAdmin) return NOT_FOUND;
  } else if (row.status !== 'sent') {
    return NOT_FOUND;
  }

  return new Response(row.webHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
