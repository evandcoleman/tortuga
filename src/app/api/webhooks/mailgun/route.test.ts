import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { sendEvents, sends, digests, recipientsCache } from '@/modules/newsletter/schema';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { writeServiceSettings } from '@/kernel/config/service-settings';

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

function insertSendAndRecipient(opts: { email: string; providerMessageId: string; active?: boolean }): void {
  const digestId = createId();
  db.insert(digests).values({
    id: digestId, scheduledAt: new Date(), windowStart: new Date(), windowEnd: new Date(),
    status: 'sent', itemCount: 1,
  }).run();
  db.insert(sends).values({
    id: createId(), digestId, recipientEmail: opts.email, recipientName: 'A',
    providerMessageId: opts.providerMessageId, provider: 'mailgun', status: 'sent',
  }).run();
  db.insert(recipientsCache).values({
    email: opts.email, name: 'A', lastSynced: new Date(), active: opts.active ?? true,
  }).run();
}

beforeEach(() => {
  db.delete(sendEvents).run();
  db.delete(sends).run();
  db.delete(digests).run();
  db.delete(recipientsCache).run();
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

  it('deactivates the recipient on a hard bounce event', async () => {
    insertSendAndRecipient({ email: 'bounced@b.io', providerMessageId: 'msg_bounced' });
    mockParseEvent.mockReturnValue({
      type: 'bounced', providerMessageId: 'msg_bounced', rawType: 'permanent_fail',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const res = await POST(makeRequest(JSON.stringify({ 'event-data': { event: 'permanent_fail' } })));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'bounced@b.io')).all()[0];
    expect(row.active).toBe(false);
    expect(row.suppressedReason).toBe('bounce');
  });

  it('deactivates the recipient on a complained event', async () => {
    insertSendAndRecipient({ email: 'complained@b.io', providerMessageId: 'msg_complained' });
    mockParseEvent.mockReturnValue({
      type: 'complained', providerMessageId: 'msg_complained', rawType: 'complained',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const res = await POST(makeRequest(JSON.stringify({ 'event-data': { event: 'complained' } })));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'complained@b.io')).all()[0];
    expect(row.active).toBe(false);
    expect(row.suppressedReason).toBe('complaint');
  });

  it('keeps the recipient active on a delivered event', async () => {
    insertSendAndRecipient({ email: 'ok@b.io', providerMessageId: 'msg_abc' });

    const res = await POST(makeRequest(JSON.stringify({ 'event-data': { event: 'delivered' } })));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'ok@b.io')).all()[0];
    expect(row.active).toBe(true);
  });

  it('keeps the recipient active on a soft (temporary_fail) bounce', async () => {
    insertSendAndRecipient({ email: 'softbounce@b.io', providerMessageId: 'msg_soft' });
    // Mailgun normalization maps temporary_fail to 'other', not 'bounced'.
    mockParseEvent.mockReturnValue({
      type: 'other', providerMessageId: 'msg_soft', rawType: 'temporary_fail',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const res = await POST(makeRequest(JSON.stringify({ 'event-data': { event: 'temporary_fail' } })));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'softbounce@b.io')).all()[0];
    expect(row.active).toBe(true);
  });

  it('does not error when a bounced event has no matching recipient', async () => {
    mockParseEvent.mockReturnValue({
      type: 'bounced', providerMessageId: 'msg_unknown', rawType: 'permanent_fail',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const res = await POST(makeRequest(JSON.stringify({ 'event-data': { event: 'permanent_fail' } })));

    expect(res.status).toBe(200);
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

  it('verifies a webhook using a DB-stored (UI-configured) secret when the env var is unset', async () => {
    const dbOnlyEnv = { SESSION_SECRET: 'x'.repeat(32) } as any;
    writeServiceSettings(db, { 'mailgun.webhook_signing_key': 'db-signing-key' }, dbOnlyEnv);

    vi.doMock('@/kernel/context', () => ({
      getAppContext: () => ({
        db,
        env: dbOnlyEnv, // no MAILGUN_WEBHOOK_SIGNING_KEY set
        email: {
          name: 'mailgun',
          verifyWebhook: mockVerifyWebhook,
          parseEvent: mockParseEvent,
        },
      }),
    }));
    const { POST: freshPost } = await import('./route?v=db-secret');

    const body = JSON.stringify({ 'event-data': { event: 'delivered' } });
    const res = await freshPost(makeRequest(body));

    expect(res.status).toBe(200);
    expect(mockVerifyWebhook).toHaveBeenCalledWith(expect.objectContaining({ secret: 'db-signing-key' }));
  });
});
