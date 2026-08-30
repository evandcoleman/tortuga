import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { digests, sends, unsubscribes } from '@/modules/newsletter/schema';
import { announcements } from '@/modules/announcements/schema';
import type { EmailProvider } from './types';

import { deliverToRecipients } from './deliver';

function fakeProvider(): EmailProvider {
  return {
    name: 'resend',
    send: vi.fn().mockResolvedValue({ providerMessageId: 'msg_1', error: null }),
    verifyWebhook: vi.fn(),
    parseEvent: vi.fn(),
  };
}

/** Seeds a digest row so `sends.digest_id` FK inserts succeed. */
function seedDigest(db: ReturnType<typeof createDb>, id: string) {
  const now = new Date();
  db.insert(digests).values({
    id, scheduledAt: now, windowStart: now, windowEnd: now, status: 'sending', itemCount: 0,
  }).run();
}

/** Seeds an announcement row so `sends.announcement_id` FK inserts succeed. */
function seedAnnouncement(db: ReturnType<typeof createDb>, id: string) {
  db.insert(announcements).values({
    id, subject: 'Hi', body: 'Body', recipientEmails: '[]', status: 'sending', createdAt: new Date(),
  }).run();
}

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

const from = { email: 'from@x.io', name: 'T' };

describe('deliverToRecipients', () => {
  it('sends to every recipient and counts successes', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    const renderFor = vi.fn().mockResolvedValue('<html>hi</html>');
    const result = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
        subject: 'Hi',
        from,
        renderFor,
        sendRow: { digestId: 'digest-1' },
      },
    );
    expect(result).toEqual({ sent: 2, failed: 0, firstFailureMessage: undefined });
    expect(provider.send).toHaveBeenCalledTimes(2);
    const rows = db.select().from(sends).all();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe('sent');
      expect(row.providerMessageId).toBe('msg_1');
      expect(row.provider).toBe('resend');
      expect(row.error).toBeNull();
      expect(row.sentAt).not.toBeNull();
    }
  });

  it('one provider failure counts as failed and continues; tracks the first failure message', async () => {
    const db = makeDb();
    seedAnnouncement(db, 'ann-1');
    const provider = fakeProvider();
    (provider.send as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ providerMessageId: null, error: 'bounced' })
      .mockResolvedValueOnce({ providerMessageId: 'msg_2', error: null });
    const result = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
        subject: 'Hi',
        from,
        renderFor: async () => '<html>hi</html>',
        sendRow: { announcementId: 'ann-1' },
      },
    );
    expect(result).toEqual({ sent: 1, failed: 1, firstFailureMessage: 'bounced' });
    expect(provider.send).toHaveBeenCalledTimes(2);
    const rows = db.select().from(sends).all();
    const failedRow = rows.find(r => r.recipientEmail === 'a@x.io');
    expect(failedRow?.status).toBe('failed');
    expect(failedRow?.error).toBe('bounced');
    expect(failedRow?.providerMessageId).toBeNull();
    const sentRow = rows.find(r => r.recipientEmail === 'b@x.io');
    expect(sentRow?.status).toBe('sent');
    expect(sentRow?.providerMessageId).toBe('msg_2');
    expect(sentRow?.error).toBeNull();
  });

  it('a render failure is recorded as a failed send and the loop continues (onRenderFailure: continue)', async () => {
    const db = makeDb();
    seedAnnouncement(db, 'ann-1');
    const provider = fakeProvider();
    const renderFor = vi.fn()
      .mockRejectedValueOnce(new Error('template exploded'))
      .mockResolvedValueOnce('<html>hi</html>');
    const result = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
        subject: 'Hi',
        from,
        renderFor,
        sendRow: { announcementId: 'ann-1' },
        onRenderFailure: 'continue',
      },
    );
    expect(result).toEqual({ sent: 1, failed: 1, firstFailureMessage: 'template exploded' });
    expect(provider.send).toHaveBeenCalledTimes(1);
    const rows = db.select().from(sends).all();
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.recipientEmail === 'a@x.io')?.status).toBe('failed');
    expect(rows.find(r => r.recipientEmail === 'a@x.io')?.error).toBe('template exploded');
    expect(rows.find(r => r.recipientEmail === 'b@x.io')?.status).toBe('sent');
  });

  it('a render failure aborts the batch and writes no send row for that recipient (onRenderFailure: abort)', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    const renderFor = vi.fn().mockRejectedValue(new Error('template exploded'));
    await expect(
      deliverToRecipients(
        { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
        {
          recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
          subject: 'Hi',
          from,
          renderFor,
          sendRow: { digestId: 'digest-1' },
          onRenderFailure: 'abort',
        },
      ),
    ).rejects.toThrow('template exploded');
    expect(provider.send).not.toHaveBeenCalled();
    expect(db.select().from(sends).all()).toHaveLength(0);
    // unsubscribe row for the first recipient was still inserted before the render threw.
    expect(db.select().from(unsubscribes).all()).toHaveLength(1);
  });

  it('writes sends rows with the correct parent FK', async () => {
    const db = makeDb();
    seedAnnouncement(db, 'ann-42');
    const provider = fakeProvider();
    await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }],
        subject: 'Hi',
        from,
        renderFor: async () => '<html>hi</html>',
        sendRow: { announcementId: 'ann-42' },
      },
    );
    const [row] = db.select().from(sends).all();
    expect(row.announcementId).toBe('ann-42');
    expect(row.digestId).toBeNull();
  });

  it('mints a per-recipient unsubscribe token and passes its URL to renderFor', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    const renderFor = vi.fn().mockResolvedValue('<html>hi</html>');
    await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }],
        subject: 'Hi',
        from,
        renderFor,
        sendRow: { digestId: 'digest-1' },
      },
    );
    const [row] = db.select().from(unsubscribes).all();
    expect(row.email).toBe('a@x.io');
    expect(renderFor).toHaveBeenCalledWith(`http://x/api/unsubscribe?token=${row.token}`);
  });

  it('passes subject, from, replyTo, and rendered html through to provider.send', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }],
        subject: 'Hello there',
        from,
        replyTo: 'reply@x.io',
        renderFor: async () => '<html>body</html>',
        sendRow: { digestId: 'digest-1' },
      },
    );
    expect(provider.send).toHaveBeenCalledWith({
      from,
      to: 'a@x.io',
      subject: 'Hello there',
      html: '<html>body</html>',
      replyTo: 'reply@x.io',
    });
  });

  it('a thrown provider.send error is recorded as a failed send', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    (provider.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const result = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }],
        subject: 'Hi',
        from,
        renderFor: async () => '<html>hi</html>',
        sendRow: { digestId: 'digest-1' },
      },
    );
    expect(result).toEqual({ sent: 0, failed: 1, firstFailureMessage: 'network down' });
    const [row] = db.select().from(sends).all();
    expect(row.status).toBe('failed');
    expect(row.error).toBe('network down');
    const digestRow = db.select().from(sends).where(eq(sends.digestId, 'digest-1')).all();
    expect(digestRow).toHaveLength(1);
  });
});
