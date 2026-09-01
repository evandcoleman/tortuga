import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

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

describe('middleware matcher', () => {
  const [pattern] = middlewareConfig.matcher;
  const re = new RegExp(`^${pattern}$`);

  it('matches dotted paths (previously excluded, hiding the portal-host 404 guard)', () => {
    expect(re.test('/api/invites/victim@example.com')).toBe(true);
    expect(re.test('/api/templates/a.b')).toBe(true);
  });

  it('still excludes _next assets and favicon.ico', () => {
    expect(re.test('/_next/static/chunk.js')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
  });
});
