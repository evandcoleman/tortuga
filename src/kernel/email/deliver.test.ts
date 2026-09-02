import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { digests, recipientsCache, sends, unsubscribes } from '@/modules/newsletter/schema';
import { announcements } from '@/modules/announcements/schema';
import { setCategory } from '@/modules/preferences/repo';
import type { EmailProvider } from './types';

import { deliverToRecipients, selectDeliverableRecipients } from './deliver';

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
        category: 'digest',
      },
    );
    expect(result).toEqual({ sent: 2, failed: 0, skippedAlreadySent: 0, firstFailureMessage: undefined });
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
        category: 'digest',
      },
    );
    expect(result).toEqual({ sent: 1, failed: 1, skippedAlreadySent: 0, firstFailureMessage: 'bounced' });
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
        category: 'digest',
        onRenderFailure: 'continue',
      },
    );
    expect(result).toEqual({ sent: 1, failed: 1, skippedAlreadySent: 0, firstFailureMessage: 'template exploded' });
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
          category: 'digest',
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
        category: 'digest',
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
        category: 'digest',
      },
    );
    const [row] = db.select().from(unsubscribes).all();
    expect(row.email).toBe('a@x.io');
    expect(row.category).toBe('digest');
    expect(renderFor).toHaveBeenCalledWith(
      {
        unsubscribeUrl: `http://x/api/unsubscribe?token=${row.token}`,
        preferencesUrl: expect.stringContaining('http://x/preferences?token='),
      },
      { email: 'a@x.io', name: 'A' },
    );
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
        renderFor: async () => '<html><body>body</body></html>',
        sendRow: { digestId: 'digest-1' },
        category: 'digest',
      },
    );
    expect(provider.send).toHaveBeenCalledWith({
      from,
      to: 'a@x.io',
      subject: 'Hello there',
      html: '<html><body>body</body></html>',
      text: expect.stringContaining('body'),
      replyTo: 'reply@x.io',
      headers: expect.objectContaining({
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }),
    });
  });

  it('sends per-recipient List-Unsubscribe headers pointing at that recipient\'s own token URL', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
        subject: 'Hi',
        from,
        renderFor: async () => '<html>hi</html>',
        sendRow: { digestId: 'digest-1' },
        category: 'digest',
      },
    );
    const tokenRows = db.select().from(unsubscribes).all();
    const tokenFor = (email: string) => tokenRows.find(r => r.email === email)!.token;

    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@x.io',
      headers: {
        'List-Unsubscribe': `<http://x/api/unsubscribe?token=${tokenFor('a@x.io')}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }));
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'b@x.io',
      headers: {
        'List-Unsubscribe': `<http://x/api/unsubscribe?token=${tokenFor('b@x.io')}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }));
  });

  it('derives a non-empty plain-text part from the rendered html', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }],
        subject: 'Hi',
        from,
        renderFor: async () => '<html><body><h1>Hello</h1><p>World</p></body></html>',
        sendRow: { digestId: 'digest-1' },
        category: 'digest',
      },
    );
    const [call] = (provider.send as ReturnType<typeof vi.fn>).mock.calls;
    const opts = call[0] as { text?: string };
    expect(opts.text).toBeTruthy();
    expect(opts.text?.toLowerCase()).toContain('hello');
    expect(opts.text).toContain('World');
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
        category: 'digest',
      },
    );
    expect(result).toEqual({ sent: 0, failed: 1, skippedAlreadySent: 0, firstFailureMessage: 'network down' });
    const [row] = db.select().from(sends).all();
    expect(row.status).toBe('failed');
    expect(row.error).toBe('network down');
    const digestRow = db.select().from(sends).where(eq(sends.digestId, 'digest-1')).all();
    expect(digestRow).toHaveLength(1);
  });

  it('retrying a digest send (onRenderFailure: abort) skips recipients already sent, but retries failed ones', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    // Seed sends rows as if a previous attempt already reached recipient a (sent)
    // and recipient c (bounced/failed), but never reached recipient b.
    db.insert(sends).values([
      {
        id: 'send-a', digestId: 'digest-1', recipientEmail: 'a@x.io', recipientName: 'A',
        status: 'sent', sentAt: new Date(),
      },
      {
        id: 'send-c', digestId: 'digest-1', recipientEmail: 'c@x.io', recipientName: 'C',
        status: 'failed', error: 'boom', sentAt: new Date(),
      },
    ]).run();

    const provider = fakeProvider();
    const renderFor = vi.fn().mockResolvedValue('<html>hi</html>');
    const result = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [
          { email: 'a@x.io', name: 'A' },
          { email: 'b@x.io', name: 'B' },
          { email: 'c@x.io', name: 'C' },
        ],
        subject: 'Hi',
        from,
        renderFor,
        sendRow: { digestId: 'digest-1' },
        category: 'digest',
        onRenderFailure: 'abort',
      },
    );

    // Only b (never sent) and c (previously failed) should be (re)sent.
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@x.io' }));
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'c@x.io' }));
    expect(result.sent).toBe(2);

    // No duplicate `sends` row was created for a@x.io.
    const aRows = db.select().from(sends).where(eq(sends.recipientEmail, 'a@x.io')).all();
    expect(aRows).toHaveLength(1);
    expect(aRows[0].status).toBe('sent');
  });

  it('reports skippedAlreadySent (not just sent) when every recipient was already sent to for this digestId', async () => {
    const db = makeDb();
    seedDigest(db, 'digest-1');
    const provider = fakeProvider();
    const renderFor = vi.fn().mockResolvedValue('<html>hi</html>');

    // First attempt: sends to both recipients.
    const first = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
        subject: 'Hi',
        from,
        renderFor,
        sendRow: { digestId: 'digest-1' },
        category: 'digest',
        onRenderFailure: 'abort',
      },
    );
    expect(first.sent).toBe(2);
    expect(first.skippedAlreadySent).toBe(0);

    // Second attempt with the same digestId: everyone was already sent to, so
    // no new provider.send calls happen, but the outcome must still be a
    // success (not a false "failed" because sent === 0).
    provider.send = vi.fn().mockResolvedValue({ providerMessageId: 'msg_2', error: null });
    const second = await deliverToRecipients(
      { db, provider, appUrl: 'http://x', sessionSecret: 's'.repeat(32) },
      {
        recipients: [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }],
        subject: 'Hi',
        from,
        renderFor,
        sendRow: { digestId: 'digest-1' },
        category: 'digest',
        onRenderFailure: 'abort',
      },
    );

    expect(provider.send).not.toHaveBeenCalled();
    expect(second.sent).toBe(0);
    expect(second.failed).toBe(0);
    expect(second.skippedAlreadySent).toBe(2);
    expect(second.sent + second.skippedAlreadySent).toBeGreaterThan(0);
  });
});

describe('selectDeliverableRecipients', () => {
  function seedRecipient(db: ReturnType<typeof createDb>, email: string, active: boolean) {
    db.insert(recipientsCache).values({
      email, name: email, lastSynced: new Date(), active, source: 'manual',
    }).run();
  }

  it('excludes inactive recipients regardless of preferences', () => {
    const db = makeDb();
    seedRecipient(db, 'active@x.io', true);
    seedRecipient(db, 'inactive@x.io', false);
    const result = selectDeliverableRecipients(db, 'digest');
    expect(result.map(r => r.email)).toEqual(['active@x.io']);
  });

  it('excludes active recipients opted out of the given category, but includes them for the other category', () => {
    const db = makeDb();
    seedRecipient(db, 'a@x.io', true);
    setCategory(db, 'a@x.io', 'digest', false);
    expect(selectDeliverableRecipients(db, 'digest').map(r => r.email)).toEqual([]);
    expect(selectDeliverableRecipients(db, 'announcements').map(r => r.email)).toEqual(['a@x.io']);
  });

  it('includes an active recipient with no preferences row (default opted-in)', () => {
    const db = makeDb();
    seedRecipient(db, 'a@x.io', true);
    expect(selectDeliverableRecipients(db, 'digest').map(r => r.email)).toEqual(['a@x.io']);
    expect(selectDeliverableRecipients(db, 'announcements').map(r => r.email)).toEqual(['a@x.io']);
  });
});
