import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache, unsubscribes } from '@/modules/newsletter/schema';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';

const SESSION_SECRET = 'a'.repeat(32);

const db = createDb(':memory:');
applyMigrations(db);

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({ db, env: { SESSION_SECRET } }),
}));

import { GET } from './route';

function req(token: string): Request {
  return new Request(`http://localhost/api/unsubscribe?token=${encodeURIComponent(token)}`);
}

beforeEach(() => {
  db.delete(unsubscribes).run();
  db.delete(recipientsCache).run();
});

describe('GET /api/unsubscribe', () => {
  it('unsubscribes on first use and deactivates the recipient', async () => {
    const email = 'u@x.io';
    const token = generateUnsubscribeToken(email, SESSION_SECRET);
    db.insert(unsubscribes).values({ token, email, createdAt: new Date() }).run();
    db.insert(recipientsCache).values({
      email, name: 'U', lastSynced: new Date(), active: true, source: 'manual',
    }).run();

    const res = await GET(req(token));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("You're unsubscribed");

    const recipient = db.select().from(recipientsCache).all()[0];
    expect(recipient.active).toBe(false);
    const row = db.select().from(unsubscribes).all()[0];
    expect(row.usedAt).not.toBeNull();
  });

  it('reports "already used" on a second request for the same token', async () => {
    const email = 'u@x.io';
    const token = generateUnsubscribeToken(email, SESSION_SECRET);
    db.insert(unsubscribes).values({ token, email, createdAt: new Date() }).run();
    db.insert(recipientsCache).values({
      email, name: 'U', lastSynced: new Date(), active: true, source: 'manual',
    }).run();

    const first = await GET(req(token));
    expect(first.status).toBe(200);

    const second = await GET(req(token));
    expect(second.status).toBe(400);
    expect(await second.text()).toContain('invalid or has been used');
  });

  it('reports "already used" for two concurrent requests racing the same token (only one wins)', async () => {
    const email = 'race@x.io';
    const token = generateUnsubscribeToken(email, SESSION_SECRET);
    db.insert(unsubscribes).values({ token, email, createdAt: new Date() }).run();
    db.insert(recipientsCache).values({
      email, name: 'R', lastSynced: new Date(), active: true, source: 'manual',
    }).run();

    // better-sqlite3 is synchronous, so issuing both GETs "concurrently" via
    // Promise.all still serializes the underlying atomic UPDATEs — this
    // proves the conditional WHERE usedAt IS NULL clause, not real
    // interleaving, is what prevents a double-unsubscribe.
    const [a, b] = await Promise.all([GET(req(token)), GET(req(token))]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    // Recipient was deactivated exactly once, not twice / inconsistently.
    const recipient = db.select().from(recipientsCache).all()[0];
    expect(recipient.active).toBe(false);
  });

  it('rejects an invalid/tampered token', async () => {
    const res = await GET(req('not-a-real-token'));
    expect(res.status).toBe(400);
  });
});
