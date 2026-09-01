import { NextResponse, type NextRequest } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { PORTAL_HOST_HEADER } from '@/modules/portal/constants';

const PUBLIC_PATHS = [
  '/login',
  '/api/healthz',
  '/api/unsubscribe',
  '/api/webhooks/resend',
  '/api/webhooks/mailgun',
  '/api/auth',
  '/issues',
];

// Single-segment, lowercase-alphanumeric-and-hyphen path — matches both the
// three built-in page slugs and the custom-page slug pattern enforced by
// `PortalCustomPageSchema` in the config schema.
const PORTAL_PAGE_PATTERN = /^\/[a-z0-9-]+$/;

const NOT_FOUND = new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

// Portal-host resolution needs `getAppContext()` (better-sqlite3, a native
// Node module) — not available on the default Edge runtime. Node.js
// middleware is stable since Next 15.5; this repo already only targets a
// single self-hosted Node.js process (see `next.config.mjs`'s
// `output: 'standalone'` and the Dockerfile's `node server.js`), so there's
// no Edge/CDN deployment target to preserve compatibility with.
export const runtime = 'nodejs';

export const config = {
  matcher: ['/((?!_next|favicon.ico|public|.*\\..*).*)'],
};

function normalizeHost(hostHeader: string | null): string {
  return (hostHeader ?? '').split(':')[0].toLowerCase();
}

/**
 * Rewrites `/` -> `/portal` and `/<page>` -> `/portal/<page>` for requests
 * on the configured portal domain, marking them public. Any other path on
 * the portal host (admin/API routes, nested paths, mixed-case paths) 404s —
 * the portal domain never serves anything but the portal.
 */
function handlePortalHost(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const target = pathname === '/' ? '/portal' : PORTAL_PAGE_PATTERN.test(pathname) ? `/portal${pathname}` : null;
  if (!target) return NOT_FOUND;

  const url = req.nextUrl.clone();
  url.pathname = target;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PORTAL_HOST_HEADER, '1');
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { portal } = getAppContext();
  const host = normalizeHost(req.headers.get('host'));

  // Host-routed portal domain: bypass auth entirely (public site). When the
  // portal is disabled, the rewrite is inert and the request falls through
  // to normal (admin) handling below — see spec "Serving model".
  if (portal.enabled && portal.domain && host === portal.domain.toLowerCase()) {
    return handlePortalHost(req);
  }

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  const mode = process.env.AUTH_MODE ?? 'session';
  if (mode === 'forward') {
    const header = process.env.AUTH_FORWARD_HEADER ?? 'Remote-User';
    if (!req.headers.get(header)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  // session mode: protected by layout-level `auth()` checks (Edge-runtime safe).
  // On the admin host, /portal/* is not in PUBLIC_PATHS, so it stays behind
  // this same auth gate — a live preview of the portal for admins only.
  return NextResponse.next();
}
