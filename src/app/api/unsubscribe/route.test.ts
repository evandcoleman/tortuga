import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache, unsubscribes } from '@/modules/newsletter/schema';
import { recipientPreferences } from '@/modules/preferences/schema';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';
import { getPreferences } from '@/modules/preferences/repo';

const SESSION_SECRET = 'a'.repeat(32);
const APP_URL = 'http://localhost';

const db = createDb(':memory:');
applyMigrations(db);

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({ db, env: { SESSION_SECRET, APP_URL } }),
}));

import { GET, POST } from './route';

function req(token: string): Request {
  return new Request(`http://localhost/api/unsubscribe?token=${encodeURIComponent(token)}`);
}

function postReq(token: string): Request {
  return new Request(`http://localhost/api/unsubscribe?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'List-Unsubscribe=One-Click',
  });
}

function seedRecipient(email: string, active = true) {
  db.insert(recipientsCache).values({
    email, name: email, lastSynced: new Date(), active, source: 'manual',
  }).run();
}

function seedToken(email: string, category: 'digest' | 'announcements' = 'digest') {
  const token = generateUnsubscribeToken(email, SESSION_SECRET);
  db.insert(unsubscribes).values({ token, email, createdAt: new Date(), category }).run();
  return token;
}

beforeEach(() => {
  db.delete(unsubscribes).run();
  db.delete(recipientsCache).run();
  db.delete(recipientPreferences).run();
});

describe('GET /api/unsubscribe', () => {
  it('unsubscribes from the token\'s category only, leaving active and the other category untouched', async () => {
    const email = 'u@x.io';
    const token = seedToken(email, 'digest');
    seedRecipient(email);

    const res = await GET(req(token));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("You're unsubscribed");
    expect(text).toContain('the weekly digest');

    const recipient = db.select().from(recipientsCache).all()[0];
    expect(recipient.active).toBe(true);
    const prefs = getPreferences(db, email);
    expect(prefs.digest).toBe(false);
    expect(prefs.announcements).toBe(true);
    const row = db.select().from(unsubscribes).all()[0];
    expect(row.usedAt).not.toBeNull();
  });

  it('unsubscribes from announcements only when the token was minted for that category', async () => {
    const email = 'u@x.io';
    const token = seedToken(email, 'announcements');
    seedRecipient(email);

    const res = await GET(req(token));
    const text = await res.text();
    expect(text).toContain('announcements');

    const prefs = getPreferences(db, email);
    expect(prefs.announcements).toBe(false);
    expect(prefs.digest).toBe(true);
  });

  it('confirmation page includes Resubscribe, Also stop other-category, and Manage preferences links', async () => {
    const email = 'u@x.io';
    const token = seedToken(email, 'digest');
    seedRecipient(email);

    const res = await GET(req(token));
    const text = await res.text();
    expect(text).toContain('Resubscribe');
    expect(text).toContain('announcements');
    expect(text).toContain('/api/unsubscribe/resubscribe');
    expect(text).toContain('Manage preferences');
    expect(text).toContain('/preferences?token=');
  });

  it('reports "already used" on a second request for the same token', async () => {
    const email = 'u@x.io';
    const token = seedToken(email);
    seedRecipient(email);

    const first = await GET(req(token));
    expect(first.status).toBe(200);

    const second = await GET(req(token));
    expect(second.status).toBe(400);
    expect(await second.text()).toContain('invalid or has been used');
  });

  it('reports "already used" for two concurrent requests racing the same token (only one wins)', async () => {
    const email = 'race@x.io';
    const token = seedToken(email);
    seedRecipient(email);

    // better-sqlite3 is synchronous, so issuing both GETs "concurrently" via
    // Promise.all still serializes the underlying atomic UPDATEs — this
    // proves the conditional WHERE usedAt IS NULL clause, not real
    // interleaving, is what prevents a double-unsubscribe.
    const [a, b] = await Promise.all([GET(req(token)), GET(req(token))]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    const prefs = getPreferences(db, 'race@x.io');
    expect(prefs.digest).toBe(false);
  });

  it('rejects an invalid/tampered token', async () => {
    const res = await GET(req('not-a-real-token'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/unsubscribe (RFC 8058 one-click)', () => {
  it('opts the recipient out of the token\'s category (not active) and returns a bare 200', async () => {
    const email = 'u@x.io';
    const token = seedToken(email, 'digest');
    seedRecipient(email);

    const res = await POST(postReq(token));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('');

    const recipient = db.select().from(recipientsCache).all()[0];
    expect(recipient.active).toBe(true);
    const prefs = getPreferences(db, email);
    expect(prefs.digest).toBe(false);
    const row = db.select().from(unsubscribes).all()[0];
    expect(row.usedAt).not.toBeNull();
  });

  it('rejects an invalid/tampered token with a bare 400', async () => {
    const res = await POST(postReq('not-a-real-token'));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('');
  });

  it('rejects a token that was already claimed', async () => {
    const email = 'u2@x.io';
    const token = seedToken(email);
    seedRecipient(email);

    const first = await POST(postReq(token));
    expect(first.status).toBe(200);

    const second = await POST(postReq(token));
    expect(second.status).toBe(400);
  });
});
