import { headers } from 'next/headers';
import { PORTAL_HOST_HEADER } from './constants';

/**
 * Portal pages are always served from `/portal/...` internally, but the
 * *browser-visible* path differs by how the request got here:
 *
 * - On the portal domain, middleware rewrites `/` -> `/portal` and
 *   `/<page>` -> `/portal/<page>` while the browser URL stays root-relative
 *   (e.g. `/getting-started`) — so internal links should be root-relative too.
 * - On the admin host (the `/portal/*` preview, behind auth), there's no
 *   rewrite — the browser URL really is `/portal/...` — so links need the
 *   `/portal` prefix.
 *
 * Middleware marks the rewritten case with `x-portal-host`; this reads that
 * back to pick the right prefix for home-grid buttons and chrome links.
 */
export async function getPortalBasePath(): Promise<string> {
  const headerList = await headers();
  return headerList.get(PORTAL_HOST_HEADER) ? '' : '/portal';
}
