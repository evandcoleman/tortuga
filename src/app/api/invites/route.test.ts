import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { invites } from '@/modules/invites/schema';

const db = createDb(':memory:');
applyMigrations(db);

const requireAdminSession = vi.fn().mockResolvedValue({ email: 'admin@x.io' });
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
  UnauthorizedError: class MockUnauthorizedError extends Error {},
}));
const { UnauthorizedError: MockUnauthorizedError } = await import('@/kernel/auth/require-admin-session');

const createInviteMock = vi.fn();
vi.mock('@/modules/invites/invite-flow', () => ({
  createInvite: (...args: unknown[]) => createInviteMock(...args),
}));

const config = { newsletter: { from: { email: 'x@x.io', name: 'X' } } };
let ctx: { db: typeof db; plex: unknown; email: unknown; config: typeof config };
vi.mock('@/kernel/context', () => ({
  getAppContext: () => ctx,
}));

import { GET, POST } from './route';

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/invites', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  db.delete(invites).run();
  requireAdminSession.mockReset();
  requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
  createInviteMock.mockReset();
  ctx = { db, plex: {}, email: {}, config };
});

describe('GET /api/invites', () => {
  it('lists invites', async () => {
    db.insert(invites).values({
      email: 'a@x.io', sectionIds: '["1"]', sentAt: new Date(), welcomeSentAt: null, status: 'pending',
    }).run();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invites).toHaveLength(1);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe('POST /api/invites', () => {
  it('returns 409 when Plex is not configured', async () => {
    ctx.plex = null;
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(409);
    expect(createInviteMock).not.toHaveBeenCalled();
  });

  it('returns 409 when no email provider is configured', async () => {
    ctx.email = null;
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(409);
  });

  it('rejects invalid input with 400', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', sectionIds: [] }));
    expect(res.status).toBe(400);
    expect(createInviteMock).not.toHaveBeenCalled();
  });

  it('returns 201 on a full success', async () => {
    createInviteMock.mockResolvedValue({ status: 'sent' });
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(201);
    expect(createInviteMock).toHaveBeenCalledWith(
      expect.objectContaining({ db, plex: ctx.plex, provider: ctx.email }),
      { email: 'a@x.io', sectionIds: ['1'] },
    );
  });

  it('returns 207 and the welcome error when the Plex invite succeeds but the email send fails', async () => {
    createInviteMock.mockResolvedValue({ status: 'invited_welcome_failed', welcomeError: 'provider down' });
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body.welcomeError).toBe('provider down');
  });

  it('returns 409 for a duplicate refusal', async () => {
    createInviteMock.mockResolvedValue({ status: 'refused', reason: 'duplicate', message: 'already invited' });
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(409);
  });

  it('returns 409 for a suppressed refusal', async () => {
    createInviteMock.mockResolvedValue({ status: 'refused', reason: 'suppressed', message: 'deactivated' });
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(409);
  });

  it('returns 502 for a plex_error refusal', async () => {
    createInviteMock.mockResolvedValue({ status: 'refused', reason: 'plex_error', message: 'plex.tv is down' });
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(502);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await POST(makeRequest({ email: 'a@x.io', sectionIds: ['1'] }));
    expect(res.status).toBe(401);
  });
});
