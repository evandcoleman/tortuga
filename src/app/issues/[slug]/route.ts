import { eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

const PUBLISHABLE_STATUSES = new Set(['sent', 'rendered']);

/**
 * Serves the immutable web-variant snapshot for a hosted newsletter issue.
 * Anyone with the (unguessable) slug can view it — no auth. 404s for an
 * unknown slug, a digest with no web_html (predates this feature), or a
 * digest that hasn't reached a publishable status yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ctx = getAppContext();
  const row = ctx.db.select().from(digests).where(eq(digests.slug, slug)).get();

  if (!row || !row.webHtml || !PUBLISHABLE_STATUSES.has(row.status)) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  }

  return new Response(row.webHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
