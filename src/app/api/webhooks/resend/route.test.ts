import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { sendEvents, sends, digests } from '@/modules/newsletter/schema';
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

describe('POST /api/webhooks/resend', () => {
  it('returns 200 and writes sendEvents row for valid delivered event when env var configured', async () => {
    const body = JSON.stringify({ type: 'email.delivered' });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const rows = db.select().from(sendEvents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('resend');
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
