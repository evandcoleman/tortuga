import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { sendEvents, sends, digests, recipientsCache } from '@/modules/newsletter/schema';
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
    env: { RESEND_WEBHOOK_SECRET: 'test-signing-key' },
    email: {
      name: 'resend',
      verifyWebhook: mockVerifyWebhook,
      parseEvent: mockParseEvent,
    },
  }),
}));

import { POST } from './route';

function makeRequest(body: string): Request {
  return new Request('http://localhost/api/webhooks/resend', {
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
    providerMessageId: opts.providerMessageId, provider: 'resend', status: 'sent',
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

describe('POST /api/webhooks/resend', () => {
  it('returns 200 and writes sendEvents row for valid delivered event when env var configured', async () => {
    const body = JSON.stringify({ type: 'email.delivered' });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const rows = db.select().from(sendEvents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('resend');
  });

  it('deactivates the recipient on a hard (Permanent) bounce event', async () => {
    insertSendAndRecipient({ email: 'bounced@b.io', providerMessageId: 'msg_bounced' });
    mockParseEvent.mockReturnValue({
      type: 'bounced', providerMessageId: 'msg_bounced', rawType: 'email.bounced',
      receivedAt: new Date('2026-05-14T00:00:00Z'), bounceType: 'permanent',
    });

    const body = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'msg_bounced', bounce: { type: 'Permanent', subType: 'General', message: 'bounced' } },
    });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'bounced@b.io')).all()[0];
    expect(row.active).toBe(false);
  });

  it('keeps the recipient active on a soft (Transient) bounce event', async () => {
    insertSendAndRecipient({ email: 'softbounce@b.io', providerMessageId: 'msg_soft' });
    mockParseEvent.mockReturnValue({
      type: 'bounced', providerMessageId: 'msg_soft', rawType: 'email.bounced',
      receivedAt: new Date('2026-05-14T00:00:00Z'), bounceType: 'transient',
    });

    const body = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'msg_soft', bounce: { type: 'Transient', subType: 'General', message: 'mailbox full' } },
    });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'softbounce@b.io')).all()[0];
    expect(row.active).toBe(true);
  });

  it('keeps the recipient active on a bounced event with no bounce subtype', async () => {
    insertSendAndRecipient({ email: 'unknownbounce@b.io', providerMessageId: 'msg_unknownsub' });
    mockParseEvent.mockReturnValue({
      type: 'bounced', providerMessageId: 'msg_unknownsub', rawType: 'email.bounced',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const body = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'msg_unknownsub' },
    });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'unknownbounce@b.io')).all()[0];
    expect(row.active).toBe(true);
  });

  it('deactivates the recipient on a complained event', async () => {
    insertSendAndRecipient({ email: 'complained@b.io', providerMessageId: 'msg_complained' });
    mockParseEvent.mockReturnValue({
      type: 'complained', providerMessageId: 'msg_complained', rawType: 'email.complained',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'msg_complained' } });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'complained@b.io')).all()[0];
    expect(row.active).toBe(false);
  });

  it('keeps the recipient active on a delivered event', async () => {
    insertSendAndRecipient({ email: 'ok@b.io', providerMessageId: 'msg_abc' });

    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_abc' } });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    const row = db.select().from(recipientsCache).where(eq(recipientsCache.email, 'ok@b.io')).all()[0];
    expect(row.active).toBe(true);
  });

  it('does not error when a bounced event has no matching recipient', async () => {
    mockParseEvent.mockReturnValue({
      type: 'bounced', providerMessageId: 'msg_unknown', rawType: 'email.bounced',
      receivedAt: new Date('2026-05-14T00:00:00Z'),
    });

    const body = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'msg_unknown', bounce: { type: 'Permanent', subType: 'General', message: 'bounced' } },
    });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
  });

  it('returns 401 for invalid signature', async () => {
    mockVerifyWebhook.mockReturnValue(false);
    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(401);
  });

  it('verifies a webhook using a DB-stored (UI-configured) secret when the env var is unset', async () => {
    const dbOnlyEnv = { SESSION_SECRET: 'x'.repeat(32) } as any;
    writeServiceSettings(db, { 'resend.webhook_secret': 'db-signing-key' }, dbOnlyEnv);

    vi.doMock('@/kernel/context', () => ({
      getAppContext: () => ({
        db,
        env: dbOnlyEnv, // no RESEND_WEBHOOK_SECRET set
        email: {
          name: 'resend',
          verifyWebhook: mockVerifyWebhook,
          parseEvent: mockParseEvent,
        },
      }),
    }));
    const { POST: freshPost } = await import('./route?v=db-secret');

    const body = JSON.stringify({ type: 'email.delivered' });
    const res = await freshPost(makeRequest(body));

    expect(res.status).toBe(200);
    expect(mockVerifyWebhook).toHaveBeenCalledWith(expect.objectContaining({ secret: 'db-signing-key' }));
  });
});
