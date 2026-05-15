import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { sendEvents, sends, digests } from '@/modules/newsletter/schema';
import { createId } from '@paralleldrive/cuid2';

const db = createDb(':memory:');
applyMigrations(db);

const mockVerifyWebhook = vi.fn().mockReturnValue(true);
const mockParseEvent = vi.fn().mockReturnValue({
  type: 'delivered',
  providerMessageId: 'msg_abc',
  rawType: 'delivered',
  receivedAt: new Date('2026-05-14T00:00:00Z'),
});

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({
    db,
    env: { MAILGUN_WEBHOOK_SIGNING_KEY: 'test-signing-key' },
    email: {
      name: 'mailgun',
      verifyWebhook: mockVerifyWebhook,
      parseEvent: mockParseEvent,
    },
  }),
}));

import { POST } from './route';

function makeRequest(body: string): Request {
  return new Request('http://localhost/api/webhooks/mailgun', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  db.delete(sendEvents).run();
  db.delete(sends).run();
  db.delete(digests).run();
  mockVerifyWebhook.mockReturnValue(true);
  mockParseEvent.mockReturnValue({
    type: 'delivered',
    providerMessageId: 'msg_abc',
    rawType: 'delivered',
    receivedAt: new Date('2026-05-14T00:00:00Z'),
  });
});

describe('POST /api/webhooks/mailgun', () => {
  it('returns 200 and writes sendEvents row for valid delivered event', async () => {
    const body = JSON.stringify({ 'event-data': { event: 'delivered' } });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const rows = db.select().from(sendEvents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('mailgun');
    expect(rows[0].type).toBe('delivered');
    expect(rows[0].providerMessageId).toBe('msg_abc');
  });

  it('updates sends.status for a terminal event when providerMessageId matches', async () => {
    // Insert a digest and send row to update
    const digestId = createId();
    db.insert(digests).values({
      id: digestId, scheduledAt: new Date(), windowStart: new Date(), windowEnd: new Date(),
      status: 'sent', itemCount: 1,
    }).run();
    const sendId = createId();
    db.insert(sends).values({
      id: sendId, digestId, recipientEmail: 'a@b.io', recipientName: 'A',
      providerMessageId: 'msg_abc', provider: 'mailgun', status: 'sent',
    }).run();

    const body = JSON.stringify({ 'event-data': { event: 'delivered' } });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const row = db.select().from(sends).all()[0];
    expect(row.status).toBe('delivered');
  });

  it('returns 401 for invalid signature', async () => {
    mockVerifyWebhook.mockReturnValue(false);
    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid signature');
  });

  it('returns 404 when configured provider is not mailgun', async () => {
    vi.doMock('@/kernel/context', () => ({
      getAppContext: () => ({
        db,
        env: { RESEND_WEBHOOK_SECRET: 'secret' },
        email: { name: 'resend', verifyWebhook: vi.fn(), parseEvent: vi.fn() },
      }),
    }));
    // Reimport to pick up new mock — use a fresh instance via dynamic import
    const { POST: freshPost } = await import('./route?v=wrong-provider');
    const res = await freshPost(makeRequest('{}'));
    expect(res.status).toBe(404);
  });
});
