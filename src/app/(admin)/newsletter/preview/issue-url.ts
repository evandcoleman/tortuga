/**
 * A digest gets an unguessable slug at creation time (see runDigest), well
 * before it has a web variant to serve — pending/skipped/failed digests all
 * have a slug but no `web_html`. The admin preview page must only show (and
 * link to) an issue URL once the hosted page will actually serve something,
 * i.e. once `web_html` has been rendered.
 */
export function digestIssueUrl(
  row: { slug: string | null; webHtml: string | null } | undefined,
  appUrl: string,
): string | null {
  if (!row || !row.slug || !row.webHtml) return null;
  return `${appUrl}/issues/${row.slug}`;
}
