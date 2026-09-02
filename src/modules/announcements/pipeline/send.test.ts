import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache, sends, unsubscribes } from '@/modules/newsletter/schema';
import type { EmailProvider } from '@/kernel/email/types';
import { setCategory } from '@/modules/preferences/repo';
import { announcements } from '../schema';
import { sendAnnouncement, type AnnouncementSendConfig } from './send';

function fakes() {
  const provider = {
    name: 'resend',
    send: vi.fn().mockResolvedValue({ providerMessageId: 'msg_1', error: null }),
    verifyWebhook: vi.fn(),
    parseEvent: vi.fn(),
  } satisfies EmailProvider;
  return { provider };
}

const baseConfig: AnnouncementSendConfig = {
  from: { email: 'from@x.io', name: 'T' },
  theme: 'editorial',
};

function seedRecipients(db: ReturnType<typeof createDb>) {
  db.insert(recipientsCache).values([
    { email: 'a@x.io', name: 'A', lastSynced: new Date(), active: true },
    { email: 'b@x.io', name: 'B', lastSynced: new Date(), active: true },
    { email: 'inactive@x.io', name: 'Inactive', lastSynced: new Date(), active: false },
  ]).run();
}

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  seedRecipients(db);
  return db;
}

describe('sendAnnouncement', () => {
  it('sends to all recipients and records status sent', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io'] },
    );
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.announcementId).toBeTruthy();
    const rows = db.select().from(announcements).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sent');
    expect(db.select().from(sends).all()).toHaveLength(2);
  });

  it('excludes a recipient opted out of the announcements category, without touching digest preference', async () => {
    const db = makeDb();
    const { provider } = fakes();
    setCategory(db, 'a@x.io', 'announcements', false);
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io'] },
    );
    expect(result.sent).toBe(1);
    const rows = db.select().from(sends).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].recipientEmail).toBe('b@x.io');
  });

  it('dryRun renders but writes nothing', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], dryRun: true },
    );
    expect(result.html).toContain('Body');
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.announcementId).toBeUndefined();
    expect(db.select().from(announcements).all()).toHaveLength(0);
    expect(db.select().from(sends).all()).toHaveLength(0);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('testRecipient sends exactly one and writes no announcement row', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: [], testRecipient: 'admin@x.io' },
    );
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.announcementId).toBeUndefined();
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(db.select().from(announcements).all()).toHaveLength(0);
    expect(db.select().from(sends).all()).toHaveLength(0);
    const [unsubRow] = db.select().from(unsubscribes).all();
    expect(unsubRow.category).toBe('announcements');
  });

  it('one provider failure yields partial with correct counts', async () => {
    const db = makeDb();
    const { provider } = fakes();
    provider.send
      .mockResolvedValueOnce({ providerMessageId: 'msg_1', error: null })
      .mockResolvedValueOnce({ providerMessageId: null, error: 'bounced' });
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io'] },
    );
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    const rows = db.select().from(announcements).all();
    expect(rows[0].status).toBe('partial');
  });

  it('returns zero sends with no announcement row when every target is inactive', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['inactive@x.io'] },
    );
    expect(result).toEqual({ html: expect.any(String), sent: 0, failed: 0 });
    expect(result.announcementId).toBeUndefined();
    expect(provider.send).not.toHaveBeenCalled();
    expect(db.select().from(announcements).all()).toHaveLength(0);
    expect(db.select().from(sends).all()).toHaveLength(0);
  });

  it('returns zero sends with no announcement row when the recipient list is empty', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: [] },
    );
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.announcementId).toBeUndefined();
    expect(provider.send).not.toHaveBeenCalled();
    expect(db.select().from(announcements).all()).toHaveLength(0);
  });

  it('persists the active-filtered targets, not the raw input list', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'inactive@x.io'] },
    );
    const row = db.select().from(announcements).all()[0];
    expect(JSON.parse(row.recipientEmails)).toEqual(['a@x.io']);
    void result;
  });

  it('records a render failure as status failed with an error message', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const boom = new Error('template exploded');
    const badTemplate = vi.fn(() => {
      throw boom;
    });
    await expect(
      sendAnnouncement(
        {
          db,
          provider,
          config: baseConfig,
          appUrl: 'http://x',
          sessionSecret: 'x'.repeat(32),
          renderEmail: badTemplate,
        },
        { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'] },
      ),
    ).rejects.toThrow('template exploded');
    const rows = db.select().from(announcements).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].error).toBe('template exploded');
  });

  it('summarises per-recipient provider failures into announcements.error', async () => {
    const db = makeDb();
    const { provider } = fakes();
    provider.send
      .mockResolvedValueOnce({ providerMessageId: 'msg_1', error: null })
      .mockResolvedValueOnce({ providerMessageId: null, error: 'bounced: mailbox full' });
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io'] },
    );
    void result;
    const rows = db.select().from(announcements).all();
    expect(rows[0].status).toBe('partial');
    expect(rows[0].error).toBe('1 of 2 failed: bounced: mailbox full');
  });

  it('substitutes {{name}} per recipient in both subject and body', async () => {
    const db = makeDb();
    const { provider } = fakes();
    await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi {{name}}', body: 'Body for {{name}}', recipientEmails: ['a@x.io', 'b@x.io'] },
    );
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@x.io', subject: 'Hi A', html: expect.stringContaining('Body for A'),
    }));
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'b@x.io', subject: 'Hi B', html: expect.stringContaining('Body for B'),
    }));
  });

  it('resolves {{server_name}} to config.from.name', async () => {
    const db = makeDb();
    const { provider } = fakes();
    await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Update from {{server_name}}', body: 'Sent by {{server_name}}', recipientEmails: ['a@x.io'] },
    );
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Update from T', html: expect.stringContaining('Sent by T'),
    }));
  });

  it('dryRun preview substitutes the Preview sample values', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi {{name}}', body: 'Body {{email}} {{server_name}}', recipientEmails: ['a@x.io'], dryRun: true },
    );
    expect(result.html).toContain('preview@tortuga.local');
    expect(result.html).toMatch(/Body\s*<a href="mailto:preview@tortuga\.local">preview@tortuga\.local<\/a> T/);
  });

  it('test send falls back to the email local part when name is unknown', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi {{name}}', body: 'Body {{name}}', recipientEmails: [], testRecipient: 'admin@x.io' },
    );
    expect(result.sent).toBe(1);
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@x.io', subject: 'Hi admin', html: expect.stringContaining('Body admin'),
    }));
  });

  it('announcements row stores the raw subject/body with tokens', async () => {
    const db = makeDb();
    const { provider } = fakes();
    await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi {{name}}', body: 'Body {{name}}', recipientEmails: ['a@x.io'] },
    );
    const [row] = db.select().from(announcements).all();
    expect(row.subject).toBe('Hi {{name}}');
    expect(row.body).toBe('Body {{name}}');
  });

  it('skips an inactive email even if passed in', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendAnnouncement(
      { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) },
      { subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'inactive@x.io'] },
    );
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@x.io' }));
  });
});
