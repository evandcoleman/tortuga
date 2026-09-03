import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { alerts, type Alert } from '@/modules/alerts/schema';

const getAppContext = vi.fn();
const requireAdminSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

import { acknowledgeAlert, acknowledgeAllAlerts } from './actions';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

function insertAlert(db: ReturnType<typeof createDb>, overrides: Partial<typeof alerts.$inferInsert> = {}): string {
  const id = createId();
  const now = new Date();
  db.insert(alerts).values({
    id,
    kind: 'digest_failed',
    key: `digest:${id}`,
    title: 'Digest failed',
    detail: 'boom',
    href: null,
    createdAt: now,
    updatedAt: now,
    acknowledgedAt: null,
    emailedAt: null,
    emailAttempts: 0,
    ...overrides,
  }).run();
  return id;
}

function getAlert(db: ReturnType<typeof createDb>, id: string): Alert {
  return db.select().from(alerts).where(eq(alerts.id, id)).all()[0];
}

describe('acknowledgeAlert', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    revalidatePath.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    const db = makeDb();
    const id = insertAlert(db);
    getAppContext.mockReturnValue({ db });
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(acknowledgeAlert(id)).rejects.toThrow('Unauthorized');
    expect(getAlert(db, id).acknowledgedAt).toBeNull();
  });

  it('rejects an empty id', async () => {
    const db = makeDb();
    getAppContext.mockReturnValue({ db });

    const result = await acknowledgeAlert('');

    expect(result).toEqual({ success: false, error: 'Invalid alert id' });
  });

  it('sets acknowledgedAt on an open alert', async () => {
    const db = makeDb();
    const id = insertAlert(db);
    getAppContext.mockReturnValue({ db });

    const result = await acknowledgeAlert(id);

    expect(result).toEqual({ success: true });
    expect(getAlert(db, id).acknowledgedAt).not.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/alerts');
  });

  it('leaves the original timestamp when acknowledged twice', async () => {
    const db = makeDb();
    const id = insertAlert(db);
    getAppContext.mockReturnValue({ db });

    await acknowledgeAlert(id);
    const first = getAlert(db, id).acknowledgedAt;

    await new Promise(resolve => setTimeout(resolve, 5));
    await acknowledgeAlert(id);
    const second = getAlert(db, id).acknowledgedAt;

    expect(second).toEqual(first);
  });
});

describe('acknowledgeAllAlerts', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    revalidatePath.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    const db = makeDb();
    const id = insertAlert(db);
    getAppContext.mockReturnValue({ db });
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(acknowledgeAllAlerts()).rejects.toThrow('Unauthorized');
    expect(getAlert(db, id).acknowledgedAt).toBeNull();
  });

  it('acknowledges every open alert and leaves already-acknowledged rows untouched', async () => {
    const db = makeDb();
    const openId1 = insertAlert(db);
    const openId2 = insertAlert(db);
    const alreadyAckedAt = new Date(Date.now() - 60_000);
    const ackedId = insertAlert(db, { acknowledgedAt: alreadyAckedAt });
    getAppContext.mockReturnValue({ db });

    const result = await acknowledgeAllAlerts();

    expect(result).toEqual({ success: true });
    expect(getAlert(db, openId1).acknowledgedAt).not.toBeNull();
    expect(getAlert(db, openId2).acknowledgedAt).not.toBeNull();
    expect(getAlert(db, ackedId).acknowledgedAt).toEqual(alreadyAckedAt);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/alerts');
  });
});
