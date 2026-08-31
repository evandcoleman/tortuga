import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
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

const getPendingInvites = vi.fn();
const cancelInvite = vi.fn();
let ctx: { db: typeof db; plex: { getPendingInvites: typeof getPendingInvites; cancelInvite: typeof cancelInvite } | null };
vi.mock('@/kernel/context', () => ({
  getAppContext: () => ctx,
}));

import { DELETE } from './route';

function params(email: string) {
  return { params: Promise.resolve({ email }) };
}

beforeEach(() => {
  db.delete(invites).run();
  requireAdminSession.mockReset();
  requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
  getPendingInvites.mockReset();
  cancelInvite.mockReset();
  ctx = { db, plex: { getPendingInvites, cancelInvite } };
});

describe('DELETE /api/invites/[email]', () => {
  it('cancels the matching plex.tv share and marks the invite cancelled', async () => {
    db.insert(invites).values({
      email: 'a@x.io', sectionIds: '["1"]', sentAt: new Date(), welcomeSentAt: null, status: 'pending',
    }).run();
    getPendingInvites.mockResolvedValue({ ok: true, data: [{ id: '999', invitedEmail: 'a@x.io', librarySectionIds: ['1'] }] });
    cancelInvite.mockResolvedValue({ ok: true, data: undefined });

    const res = await DELETE(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(200);
    expect(cancelInvite).toHaveBeenCalledWith('999');
    const row = db.select().from(invites).where(eq(invites.email, 'a@x.io')).get();
    expect(row?.status).toBe('cancelled');
  });

  it('still marks the local row cancelled when the email is no longer in the plex.tv pending list', async () => {
    db.insert(invites).values({
      email: 'a@x.io', sectionIds: '["1"]', sentAt: new Date(), welcomeSentAt: null, status: 'pending',
    }).run();
    getPendingInvites.mockResolvedValue({ ok: true, data: [] });

    const res = await DELETE(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(200);
    expect(cancelInvite).not.toHaveBeenCalled();
    const row = db.select().from(invites).where(eq(invites.email, 'a@x.io')).get();
    expect(row?.status).toBe('cancelled');
  });

  it('returns 404 for an unknown email', async () => {
    const res = await DELETE(new Request('http://localhost'), params('nope@x.io'));
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await DELETE(new Request('http://localhost'), params('a@x.io'));
    expect(res.status).toBe(401);
  });
});
