import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { templates } from '@/modules/templates/schema';

const db = createDb(':memory:');
applyMigrations(db);

const requireAdminSession = vi.fn().mockResolvedValue({ email: 'admin@x.io' });
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
  UnauthorizedError: class MockUnauthorizedError extends Error {},
}));

const { UnauthorizedError: MockUnauthorizedError } = await import('@/kernel/auth/require-admin-session');

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({
    db,
    config: { newsletter: { from: { email: 'from@x.io', name: 'Aurora' }, theme: 'editorial' } },
  }),
}));

import { POST } from './route';

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/templates/welcome/preview', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  db.delete(templates).run();
  requireAdminSession.mockReset();
  requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
  db.insert(templates).values({
    id: '1', slug: 'welcome', name: 'Welcome', subject: 'Hi {{name}}', body: 'Join **{{server_name}}**.',
    createdAt: new Date(), updatedAt: new Date(),
  }).run();
});

describe('POST /api/templates/:slug/preview', () => {
  it('renders the template with substituted variables', async () => {
    const res = await POST(makeRequest({ name: 'Ada', email: 'ada@x.io' }), params('welcome'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subject).toBe('Hi Ada');
    expect(body.html).toContain('<strong>Aurora</strong>');
    expect(body.text).toContain('Join Aurora.');
  });

  it('falls back to placeholder values when no overrides are given', async () => {
    const res = await POST(makeRequest({}), params('welcome'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.subject).toContain('Hi ');
  });

  it('renders unsaved subject/body overrides instead of the stored template content', async () => {
    const res = await POST(
      makeRequest({ name: 'Ada', email: 'ada@x.io', subject: 'Draft subject {{name}}', body: 'Draft body **{{server_name}}**.' }),
      params('welcome'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subject).toBe('Draft subject Ada');
    expect(body.html).toContain('<strong>Aurora</strong>');
    expect(body.text).toContain('Draft body Aurora.');
  });

  it('falls back to the stored template when overrides are absent, even with other fields present', async () => {
    const res = await POST(makeRequest({ name: 'Ada' }), params('welcome'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.subject).toBe('Hi Ada');
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await POST(makeRequest({}), params('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await POST(makeRequest({}), params('welcome'));
    expect(res.status).toBe(401);
  });
});
