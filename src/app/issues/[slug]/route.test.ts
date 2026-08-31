import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockDigestRow {
  slug: string;
  webHtml: string | null;
  status: string;
}

interface MockState {
  rows: MockDigestRow[];
}

const state: MockState = { rows: [] };

function makeQuery() {
  const chain = {
    from: () => chain,
    where: (predicate: (row: MockDigestRow) => boolean) => ({
      get: () => state.rows.find(predicate),
    }),
  };
  return chain;
}

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({
    db: { select: () => makeQuery() },
  }),
}));

// Minimal drizzle `eq` stand-in matching the shape used by the route: builds a
// predicate the mocked `.where()` above can apply to an in-memory row. The real
// schema column object's `.name` is the snake_case DB column name, which lines
// up with this mock's plain-object row keys (both just "slug").
vi.mock('drizzle-orm', () => ({
  eq: (column: { name: keyof MockDigestRow }, value: string) => (row: MockDigestRow) => row[column.name] === value,
}));

const requireAdminSession = vi.fn();
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { GET } from './route';

function req(slug: string) {
  return new Request(`http://x/issues/${slug}`);
}

beforeEach(() => {
  state.rows = [];
  requireAdminSession.mockReset();
  requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
});

describe('GET /issues/[slug]', () => {
  it('serves the stored web_html for a sent digest without checking admin session', async () => {
    state.rows = [{ slug: 'abc123', webHtml: '<html><body>Issue</body></html>', status: 'sent' }];
    const res = await GET(req('abc123'), { params: Promise.resolve({ slug: 'abc123' }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Issue');
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(requireAdminSession).not.toHaveBeenCalled();
  });

  it('serves a rendered (not-yet-sent) digest to an authenticated admin', async () => {
    requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
    state.rows = [{ slug: 'abc123', webHtml: '<html><body>Draft</body></html>', status: 'rendered' }];
    const res = await GET(req('abc123'), { params: Promise.resolve({ slug: 'abc123' }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Draft');
  });

  it('404s a rendered (not-yet-sent) digest for an unauthenticated request', async () => {
    state.rows = [{ slug: 'abc123', webHtml: '<html><body>Draft</body></html>', status: 'rendered' }];
    const res = await GET(req('abc123'), { params: Promise.resolve({ slug: 'abc123' }) });
    expect(res.status).toBe(404);
  });

  it('404s for an unknown slug', async () => {
    const res = await GET(req('nope'), { params: Promise.resolve({ slug: 'nope' }) });
    expect(res.status).toBe(404);
  });

  it('404s for a digest with no web_html', async () => {
    state.rows = [{ slug: 'abc123', webHtml: null, status: 'sent' }];
    const res = await GET(req('abc123'), { params: Promise.resolve({ slug: 'abc123' }) });
    expect(res.status).toBe(404);
  });

  it('404s for a digest in an unpublished status (e.g. pending/failed/skipped)', async () => {
    state.rows = [{ slug: 'abc123', webHtml: '<html></html>', status: 'failed' }];
    const res = await GET(req('abc123'), { params: Promise.resolve({ slug: 'abc123' }) });
    expect(res.status).toBe(404);
  });
});
