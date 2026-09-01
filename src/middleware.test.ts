import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
// Next's own build-time matcher compiler (not a public API, but the most
// faithful way to assert on matcher semantics — see usage below).
import { getMiddlewareMatchers } from 'next/dist/build/analysis/get-page-static-info';

interface MockPortalConfig {
  enabled: boolean;
  domain?: string;
}

const state: { portal: MockPortalConfig } = { portal: { enabled: false } };

vi.mock('@/kernel/context', () => ({
  getPortalHostConfigFresh: () => state.portal,
}));

import middleware, { config as middlewareConfig } from './middleware';

const originalAuthMode = process.env.AUTH_MODE;

beforeEach(() => {
  process.env.AUTH_MODE = 'forward';
  delete process.env.AUTH_FORWARD_HEADER;
  state.portal = { enabled: false };
});

afterEach(() => {
  process.env.AUTH_MODE = originalAuthMode;
});

function reqFor(
  path: string,
  opts: { host?: string; headers?: Record<string, string>; method?: string } = {},
) {
  const headers = { host: opts.host ?? 'admin.example', ...opts.headers };
  return new NextRequest(new Request(`http://${headers.host}${path}`, { headers, method: opts.method }));
}

describe('middleware public paths (admin host, unaffected by portal)', () => {
  it('allows /issues/[slug] without auth', () => {
    const res = middleware(reqFor('/issues/abc123'));
    expect(res.status).toBe(200);
  });

  it('still requires auth for other admin paths', () => {
    const res = middleware(reqFor('/newsletter/preview'));
    expect(res.status).toBe(401);
  });

  it('keeps /portal/* behind auth on the admin host (preview)', () => {
    const res = middleware(reqFor('/portal'));
    expect(res.status).toBe(401);
  });

  it('lets an authenticated admin preview /portal/*', () => {
    const res = middleware(reqFor('/portal/getting-started', { headers: { 'remote-user': 'admin@x.io' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});

/**
 * A vanilla `NextResponse.next()` carries no `x-middleware-override-headers`
 * at all, so it can't be used to assert a header was *stripped* — absence of
 * the override list looks identical to "nothing was touched". These checks
 * require the override list to be present (proving the request headers were
 * explicitly rebuilt) and to omit `x-portal-host`.
 */
function forwardedHeaderNames(res: Response): string[] {
  return (res.headers.get('x-middleware-override-headers') ?? '').split(',').filter(Boolean);
}

describe('middleware strips a forged x-portal-host header on non-rewrite paths', () => {
  it('does not forward a forged x-portal-host header on the admin host (forward mode)', () => {
    const res = middleware(
      reqFor('/newsletter/preview', {
        headers: { 'remote-user': 'admin@x.io', 'x-portal-host': 'evil' },
      }),
    );
    expect(res.status).toBe(200);
    const forwarded = forwardedHeaderNames(res);
    expect(forwarded.length).toBeGreaterThan(0);
    expect(forwarded).not.toContain('x-portal-host');
    expect(res.headers.get('x-middleware-request-x-portal-host')).toBeNull();
  });

  it('does not forward a forged x-portal-host header on the admin host (session mode)', () => {
    process.env.AUTH_MODE = 'session';
    const res = middleware(reqFor('/newsletter/preview', { headers: { 'x-portal-host': 'evil' } }));
    expect(res.status).toBe(200);
    const forwarded = forwardedHeaderNames(res);
    expect(forwarded.length).toBeGreaterThan(0);
    expect(forwarded).not.toContain('x-portal-host');
    expect(res.headers.get('x-middleware-request-x-portal-host')).toBeNull();
  });

  it('does not forward a forged x-portal-host header on the portal domain when the portal is disabled', () => {
    state.portal = { enabled: false, domain: 'plex.example.com' };
    const res = middleware(
      reqFor('/', { host: 'plex.example.com', headers: { 'remote-user': 'admin@x.io', 'x-portal-host': 'evil' } }),
    );
    expect(res.status).toBe(200);
    const forwarded = forwardedHeaderNames(res);
    expect(forwarded.length).toBeGreaterThan(0);
    expect(forwarded).not.toContain('x-portal-host');
    expect(res.headers.get('x-middleware-request-x-portal-host')).toBeNull();
  });
});

describe('middleware portal-host rewrite', () => {
  beforeEach(() => {
    state.portal = { enabled: true, domain: 'plex.example.com' };
  });

  it('rewrites / -> /portal and marks the request public (no auth required)', () => {
    const res = middleware(reqFor('/', { host: 'plex.example.com' }));
    expect(res.status).toBe(200);
    const rewrite = res.headers.get('x-middleware-rewrite');
    expect(rewrite).toContain('/portal');
    expect(rewrite).not.toContain('/portal/');
  });

  it('rewrites /<page> -> /portal/<page>', () => {
    const res = middleware(reqFor('/getting-started', { host: 'plex.example.com' }));
    const rewrite = res.headers.get('x-middleware-rewrite');
    expect(rewrite).toContain('/portal/getting-started');
  });

  it('rewrites a custom page slug the same generic way', () => {
    const res = middleware(reqFor('/faq', { host: 'plex.example.com' }));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/portal/faq');
  });

  it('marks the rewritten request with the portal host header', () => {
    const res = middleware(reqFor('/getting-started', { host: 'plex.example.com' }));
    expect(res.headers.get('x-middleware-request-x-portal-host')).toBe('1');
  });

  it('is case-insensitive on the configured domain', () => {
    const res = middleware(reqFor('/', { host: 'PLEX.EXAMPLE.COM' }));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/portal');
  });

  it('404s admin/API paths on the portal host', () => {
    const res = middleware(reqFor('/api/healthz', { host: 'plex.example.com' }));
    expect(res.status).toBe(404);
  });

  it('404s nested paths on the portal host', () => {
    const res = middleware(reqFor('/foo/bar', { host: 'plex.example.com' }));
    expect(res.status).toBe(404);
  });

  it('404s mixed-case paths on the portal host', () => {
    const res = middleware(reqFor('/Getting-Started', { host: 'plex.example.com' }));
    expect(res.status).toBe(404);
  });

  it('does not require a Remote-User header on the portal host', () => {
    const res = middleware(reqFor('/getting-started', { host: 'plex.example.com' }));
    expect(res.status).toBe(200);
  });

  it('leaves the host rewrite inert when the portal is disabled, falling through to normal auth', () => {
    state.portal = { enabled: false, domain: 'plex.example.com' };
    const res = middleware(reqFor('/', { host: 'plex.example.com' }));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.status).toBe(401);
  });

  it('does not affect a request to a different host, even with a matching path', () => {
    const res = middleware(reqFor('/getting-started', { host: 'admin.example' }));
    expect(res.status).toBe(401);
  });

  it('404s a dotted admin-API-shaped path on the portal host (regression: matcher used to skip these)', () => {
    const res = middleware(reqFor('/api/invites/victim@example.com', { host: 'plex.example.com' }));
    expect(res.status).toBe(404);
  });

  it('strips an inbound forward-auth header before rewriting, rather than forwarding it verbatim', () => {
    const res = middleware(
      reqFor('/getting-started', { host: 'plex.example.com', headers: { 'remote-user': 'admin@x.io' } }),
    );
    expect(res.headers.get('x-middleware-request-remote-user')).toBeNull();
  });

  it('does not let a forged inbound x-portal-host header leak through unmarked', () => {
    const res = middleware(
      reqFor('/getting-started', { host: 'plex.example.com', headers: { 'x-portal-host': 'evil' } }),
    );
    expect(res.headers.get('x-middleware-request-x-portal-host')).toBe('1');
  });

  it('404s a non-GET/HEAD request on the portal host (blocks server-action-style dispatch)', () => {
    const res = middleware(reqFor('/getting-started', { host: 'plex.example.com', method: 'POST' }));
    expect(res.status).toBe(404);
  });

  it('404s a request carrying a Next-Action header on the portal host', () => {
    const res = middleware(
      reqFor('/getting-started', { host: 'plex.example.com', headers: { 'next-action': 'abc123' } }),
    );
    expect(res.status).toBe(404);
  });
});

// Uses Next's own build-time matcher compiler instead of a hand-built regex,
// so these assertions track what Next actually invokes middleware for —
// including the `/_next/data/<build-id>/...` prefix and `.json`/`.rsc`/
// `.segments/*.segment.rsc` transport suffixes it always adds, which a naive
// `new RegExp('^' + pattern + '$')` would miss entirely.
describe('middleware matcher (compiled with Next\'s own matcher builder)', () => {
  const [compiled] = getMiddlewareMatchers(middlewareConfig.matcher, {});
  const re = new RegExp(compiled.regexp);

  it('matches dotted paths (previously excluded, hiding the portal-host 404 guard)', () => {
    expect(re.test('/api/invites/victim@example.com')).toBe(true);
    expect(re.test('/api/templates/a.b')).toBe(true);
  });

  it('still excludes _next assets and favicon.ico', () => {
    expect(re.test('/_next/static/chunk.js')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
  });

  it('matches the /_next/data/<build-id>/... transport prefix Next always adds', () => {
    expect(re.test('/_next/data/abc123/newsletter/preview.json')).toBe(true);
  });

  it('matches the .rsc app-router transport suffix', () => {
    expect(re.test('/newsletter/preview.rsc')).toBe(true);
  });

  it('matches the .segments/*.segment.rsc app-router transport suffix', () => {
    expect(re.test('/newsletter/preview.segments/children.segment.rsc')).toBe(true);
  });
});

describe('middleware behavior for transport-suffixed paths on the portal host', () => {
  beforeEach(() => {
    state.portal = { enabled: true, domain: 'plex.example.com' };
  });

  it('404s a .json data-route request for an admin path instead of leaking it', () => {
    const res = middleware(reqFor('/_next/data/abc123/newsletter/preview.json', { host: 'plex.example.com' }));
    expect(res.status).toBe(404);
  });

  it('404s a .rsc-suffixed request for an admin path instead of leaking it', () => {
    const res = middleware(reqFor('/newsletter/preview.rsc', { host: 'plex.example.com' }));
    expect(res.status).toBe(404);
  });
});
