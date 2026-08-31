import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { templates } from '@/modules/templates/schema';
import { seedWelcomeTemplate } from '@/modules/templates/seed';

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

import { GET, PATCH, DELETE } from './route';

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/templates/x', {
    method,
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
    id: '1', slug: 'a', name: 'A', subject: 'S', body: 'B', createdAt: new Date(), updatedAt: new Date(),
  }).run();
});

describe('GET /api/templates/:slug', () => {
  it('fetches an existing template', async () => {
    const res = await GET(makeRequest('GET'), params('a'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.template.slug).toBe('a');
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await GET(makeRequest('GET'), params('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await GET(makeRequest('GET'), params('a'));
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/templates/:slug', () => {
  it('updates a template', async () => {
    const res = await PATCH(makeRequest('PATCH', { subject: 'New subject' }), params('a'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.template.subject).toBe('New subject');
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await PATCH(makeRequest('PATCH', { subject: 'New' }), params('nope'));
    expect(res.status).toBe(404);
  });

  it('rejects invalid input with 400', async () => {
    const res = await PATCH(makeRequest('PATCH', {}), params('a'));
    expect(res.status).toBe(400);
  });

  it('allows editing the seeded welcome template', async () => {
    seedWelcomeTemplate(db);
    const res = await PATCH(makeRequest('PATCH', { subject: 'Custom' }), params('welcome'));
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/templates/:slug', () => {
  it('deletes a non-seed template', async () => {
    const res = await DELETE(makeRequest('DELETE'), params('a'));
    expect(res.status).toBe(204);
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await DELETE(makeRequest('DELETE'), params('nope'));
    expect(res.status).toBe(404);
  });

  it('refuses to delete the seeded welcome template with 409', async () => {
    seedWelcomeTemplate(db);
    const res = await DELETE(makeRequest('DELETE'), params('welcome'));
    expect(res.status).toBe(409);
  });
});
