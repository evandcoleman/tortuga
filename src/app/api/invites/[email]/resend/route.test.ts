import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { invites } from '@/modules/invites/schema';
import { recipientsCache } from '@/modules/newsletter/schema';

const db = createDb(':memory:');
applyMigrations(db);

const requireAdminSession = vi.fn().mockResolvedValue({ email: 'admin@x.io' });
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
  UnauthorizedError: class MockUnauthorizedError extends Error {},
}));
const { UnauthorizedError: MockUnauthorizedError } = await import('@/kernel/auth/require-admin-session');

const sendWelcomeEmailMock = vi.fn();
vi.mock('@/modules/invites/send-welcome', () => ({
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmailMock(...args),
}));

const config = { newsletter: { from: { email: 'x@x.io', name: 'X' } } };
const getPendingInvites = vi.fn();
let ctx: {
  db: typeof db;
  email: unknown;
  config: typeof config;
  plex: { getPendingInvites: typeof getPendingInvites } | null;
};
vi.mock('@/kernel/context', () => ({
  getAppContext: () => ctx,
}));

import { POST } from './route';

function params(email: string) {
  return { params: Promise.resolve({ email }) };
}

beforeEach(() => {
  db.delete(invites).run();
  db.delete(recipientsCache).run();
  requireAdminSession.mockReset();
  requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
  sendWelcomeEmailMock.mockReset();
  getPendingInvites.mockReset();
  ctx = { db, email: {}, config, plex: { getPendingInvites } };
});

describe('POST /api/invites/[email]/resend', () => {
  it('sends the welcome email and marks welcomeSentAt', async () => {
    db.insert(invites).values({
      email: 'a@x.io', sectionIds: '["1"]', sentAt: new Date(), welcomeSentAt: null, status: 'pending',
    }).run();
    sendWelcomeEmailMock.mockResolvedValue({ ok: true });

    const res = await POST(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(200);
    const invite = db.select().from(invites).where(eq(invites.email, 'a@x.io')).get();
    expect(invite?.welcomeSentAt).not.toBeNull();
  });

  it('returns 404 for an email with no invite row', async () => {
    getPendingInvites.mockResolvedValue({ ok: true, data: [] });
    const res = await POST(new Request('http://localhost'), params('nope@x.io'));
    expect(res.status).toBe(404);
  });

  it('sends the welcome email and creates a local row when the email has no local row but is a pending plex.tv invite', async () => {
    getPendingInvites.mockResolvedValue({
      ok: true,
      data: [{ id: '1', invitedEmail: 'B@X.IO', friend: true, home: false, server: true }],
    });
    sendWelcomeEmailMock.mockResolvedValue({ ok: true });

    const res = await POST(new Request('http://localhost'), params('b@x.io'));

    expect(res.status).toBe(200);
    expect(sendWelcomeEmailMock).toHaveBeenCalled();
    const invite = db.select().from(invites).where(eq(invites.email, 'b@x.io')).get();
    expect(invite).not.toBeNull();
    expect(invite?.status).toBe('pending');
    expect(invite?.welcomeSentAt).not.toBeNull();
  });

  it('returns 404 when there is no local row and the email is not a pending plex.tv invite either', async () => {
    getPendingInvites.mockResolvedValue({ ok: true, data: [] });
    const res = await POST(new Request('http://localhost'), params('nope@x.io'));
    expect(res.status).toBe(404);
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });

  it('returns 404 when there is no local row and plex is not configured', async () => {
    ctx = { ...ctx, plex: null };
    const res = await POST(new Request('http://localhost'), params('nope@x.io'));
    expect(res.status).toBe(404);
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });

  it('refuses a deactivated recipient with 409', async () => {
    db.insert(invites).values({
      email: 'a@x.io', sectionIds: '["1"]', sentAt: new Date(), welcomeSentAt: null, status: 'pending',
    }).run();
    db.insert(recipientsCache).values({
      email: 'a@x.io', name: 'A', lastSynced: new Date(), active: false, source: 'plex',
    }).run();

    const res = await POST(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(409);
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the send fails', async () => {
    db.insert(invites).values({
      email: 'a@x.io', sectionIds: '["1"]', sentAt: new Date(), welcomeSentAt: null, status: 'pending',
    }).run();
    sendWelcomeEmailMock.mockResolvedValue({ ok: false, error: 'provider down' });

    const res = await POST(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(502);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await POST(new Request('http://localhost'), params('a@x.io'));
    expect(res.status).toBe(401);
  });
});
