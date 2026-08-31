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
  getAppContext: () => ({ db }),
}));

import { GET, POST } from './route';

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/templates', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  db.delete(templates).run();
  requireAdminSession.mockReset();
  requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
});

describe('GET /api/templates', () => {
  it('lists templates', async () => {
    db.insert(templates).values({
      id: '1', slug: 'a', name: 'A', subject: 'S', body: 'B', createdAt: new Date(), updatedAt: new Date(),
    }).run();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].slug).toBe('a');
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());

    const res = await GET();

    expect(res.status).toBe(401);
  });
});

describe('POST /api/templates', () => {
  it('creates a template', async () => {
    const res = await POST(makeRequest({ slug: 'new-one', name: 'New', subject: 'Hi', body: 'Body' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.template.slug).toBe('new-one');
  });

  it('rejects invalid input with 400', async () => {
    const res = await POST(makeRequest({ slug: '', name: '', subject: '', body: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate slug with 409', async () => {
    db.insert(templates).values({
      id: '1', slug: 'dup', name: 'A', subject: 'S', body: 'B', createdAt: new Date(), updatedAt: new Date(),
    }).run();

    const res = await POST(makeRequest({ slug: 'dup', name: 'B', subject: 'S', body: 'B' }));

    expect(res.status).toBe(409);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());

    const res = await POST(makeRequest({ slug: 'x', name: 'X', subject: 'S', body: 'B' }));

    expect(res.status).toBe(401);
  });
});
