import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
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
let ctx: { db: typeof db; email: unknown; config: typeof config };
vi.mock('@/kernel/context', () => ({
  getAppContext: () => ctx,
}));

import { POST } from './route';

function params(email: string) {
  return { params: Promise.resolve({ email }) };
}

beforeEach(() => {
  db.delete(recipientsCache).run();
  requireAdminSession.mockReset();
  requireAdminSession.mockResolvedValue({ email: 'admin@x.io' });
  sendWelcomeEmailMock.mockReset();
  ctx = { db, email: {}, config };
});

describe('POST /api/recipients/[email]/welcome', () => {
  it('sends the welcome email and sets welcomedAt even with no invites row', async () => {
    db.insert(recipientsCache).values({
      email: 'a@x.io', name: 'A', lastSynced: new Date(), active: true, source: 'plex',
    }).run();
    sendWelcomeEmailMock.mockResolvedValue({ ok: true });

    const res = await POST(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'a@x.io')).get();
    expect(row?.welcomedAt).not.toBeNull();
    expect(sendWelcomeEmailMock).toHaveBeenCalledWith(expect.anything(), { email: 'a@x.io', name: 'A' });
  });

  it('returns 404 for an unknown recipient', async () => {
    const res = await POST(new Request('http://localhost'), params('nope@x.io'));
    expect(res.status).toBe(404);
  });

  it('refuses a deactivated recipient with 409', async () => {
    db.insert(recipientsCache).values({
      email: 'a@x.io', name: 'A', lastSynced: new Date(), active: false, source: 'plex',
    }).run();

    const res = await POST(new Request('http://localhost'), params('a@x.io'));

    expect(res.status).toBe(409);
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminSession.mockRejectedValue(new MockUnauthorizedError());
    const res = await POST(new Request('http://localhost'), params('a@x.io'));
    expect(res.status).toBe(401);
  });
});
