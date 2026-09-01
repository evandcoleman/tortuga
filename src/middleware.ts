import { NextResponse, type NextRequest } from 'next/server';
import { getPortalHostConfigFresh } from '@/kernel/context';
import { PORTAL_HOST_HEADER } from '@/modules/portal/constants';

/** Header Next.js sets on server-action POST requests (see `ACTION_HEADER` in next/dist). */
const NEXT_ACTION_HEADER = 'next-action';

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

/** Header carrying the forward-auth principal, configurable per deployment. */
function authForwardHeader(): string {
  return process.env.AUTH_FORWARD_HEADER ?? 'Remote-User';
}

// Portal-host resolution needs `getAppContext()` (better-sqlite3, a native
// Node module) — not available on the default Edge runtime. Node.js
// middleware is stable since Next 15.5; this repo already only targets a
// single self-hosted Node.js process (see `next.config.mjs`'s
// `output: 'standalone'` and the Dockerfile's `node server.js`), so there's
// no Edge/CDN deployment target to preserve compatibility with.
export const runtime = 'nodejs';

// Deliberately does NOT exclude dotted paths (e.g. `/api/invites/victim@example.com`)
// or a `/public` prefix (Next serves `public/` assets at the root, not under
// `/public`, so that exclusion was dead weight) — every non-`_next`/favicon path
// must pass through here so the portal-host guard below can 404 anything it
// doesn't explicitly allow. On the admin host this now also runs auth checks for
// paths that used to slip through (e.g. `/file.svg`); Authelia forward-auth
// already covers those at the edge in `forward` mode, so this is consistent with
// existing behavior for real deployments, not a new restriction.
export const config = {
  matcher: ['/((?!_next/|favicon\\.ico$).*)'],
};

function normalizeHost(hostHeader: string | null): string {
  return (hostHeader ?? '').split(':')[0].toLowerCase();
}

/**
 * Rewrites `/` -> `/portal` and `/<page>` -> `/portal/<page>` for requests
 * on the configured portal domain, marking them public. Any other path on
 * the portal host (admin/API routes, nested paths, mixed-case paths) 404s —
 * the portal domain never serves anything but the portal.
 *
 * The portal host has Authelia bypassed at the edge, so this function is the
 * *only* auth boundary those requests see. It therefore also: (1) strips any
 * inbound forward-auth / portal-host marker headers before rewriting, so a
 * client can't forge `Remote-User` or `x-portal-host` to reach code that
 * trusts them downstream, and (2) 404s anything that isn't a plain page GET —
 * non-GET/HEAD methods and Next.js server-action dispatch (`Next-Action`
 * header) never have legitimate business on the public portal domain.
 */
function handlePortalHost(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (req.method !== 'GET' && req.method !== 'HEAD') return NOT_FOUND;
  if (req.headers.has(NEXT_ACTION_HEADER)) return NOT_FOUND;

  const target = pathname === '/' ? '/portal' : PORTAL_PAGE_PATTERN.test(pathname) ? `/portal${pathname}` : null;
  if (!target) return NOT_FOUND;

  const url = req.nextUrl.clone();
  url.pathname = target;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(authForwardHeader());
  requestHeaders.set(PORTAL_HOST_HEADER, '1');
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const portal = getPortalHostConfigFresh();
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
    if (!req.headers.get(authForwardHeader())) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  // session mode: protected by layout-level `auth()` checks (Edge-runtime safe).
  // On the admin host, /portal/* is not in PUBLIC_PATHS, so it stays behind
  // this same auth gate — a live preview of the portal for admins only.
  return NextResponse.next();
}
