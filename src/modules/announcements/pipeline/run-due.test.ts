import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { eq } from 'drizzle-orm';
import { recipientsCache, sends } from '@/modules/newsletter/schema';
import { setCategory } from '@/modules/preferences/repo';
import type { EmailProvider } from '@/kernel/email/types';
import { announcements } from '../schema';
import { scheduleAnnouncement } from './schedule';
import type { AnnouncementSendConfig, SendAnnouncementDeps } from './send';
import { sendScheduledAnnouncement, runDueAnnouncements } from './run-due';

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

function makeDeps(db: ReturnType<typeof createDb>, provider: EmailProvider): SendAnnouncementDeps {
  return { db, provider, config: baseConfig, appUrl: 'http://x', sessionSecret: 'x'.repeat(32) };
}

describe('sendScheduledAnnouncement', () => {
  it('sends a due row and links sends via sendRow', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io'], scheduledAt: new Date(),
    });
    const result = await sendScheduledAnnouncement(makeDeps(db, provider), id);
    expect(result).toEqual({ outcome: 'sent', sent: 2, failed: 0 });
    const [row] = db.select().from(announcements).where(eq(announcements.id, id)).all();
    expect(row.status).toBe('sent');
    const sendRows = db.select().from(sends).all();
    expect(sendRows).toHaveLength(2);
    expect(sendRows.every(s => s.announcementId === id)).toBe(true);
  });

  it('returns skipped and makes no change on a second claim of the same id', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], scheduledAt: new Date(),
    });
    const first = await sendScheduledAnnouncement(makeDeps(db, provider), id);
    expect(first.outcome).toBe('sent');
    const second = await sendScheduledAnnouncement(makeDeps(db, provider), id);
    expect(second).toEqual({ outcome: 'skipped', sent: 0, failed: 0 });
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it('drops recipients inactive, unsubscribed, or suppressed at send time', async () => {
    const db = makeDb();
    const { provider } = fakes();
    setCategory(db, 'a@x.io', 'announcements', false);
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io', 'inactive@x.io'], scheduledAt: new Date(),
    });
    const result = await sendScheduledAnnouncement(makeDeps(db, provider), id);
    expect(result).toEqual({ outcome: 'sent', sent: 1, failed: 0 });
    const [row] = db.select().from(announcements).where(eq(announcements.id, id)).all();
    expect(JSON.parse(row.recipientEmails)).toEqual(['b@x.io']);
  });

  it('marks failed with a specific error when zero recipients are deliverable at send time', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['inactive@x.io'], scheduledAt: new Date(),
    });
    const result = await sendScheduledAnnouncement(makeDeps(db, provider), id);
    expect(result).toEqual({ outcome: 'failed', sent: 0, failed: 0 });
    const [row] = db.select().from(announcements).where(eq(announcements.id, id)).all();
    expect(row.status).toBe('failed');
    expect(row.error).toBe('No deliverable recipients at send time');
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('marks failed without throwing when render fails', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], scheduledAt: new Date(),
    });
    const boom = new Error('template exploded');
    const deps: SendAnnouncementDeps = {
      ...makeDeps(db, provider),
      renderEmail: vi.fn(() => { throw boom; }),
    };
    const result = await sendScheduledAnnouncement(deps, id);
    expect(result).toEqual({ outcome: 'failed', sent: 0, failed: 0 });
    const [row] = db.select().from(announcements).where(eq(announcements.id, id)).all();
    expect(row.status).toBe('failed');
    expect(row.error).toBe('template exploded');
  });

  it('substitutes {{name}} per recipient for a scheduled send', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi {{name}}', body: 'Body for {{name}}', recipientEmails: ['a@x.io', 'b@x.io'], scheduledAt: new Date(),
    });
    const result = await sendScheduledAnnouncement(makeDeps(db, provider), id);
    expect(result).toEqual({ outcome: 'sent', sent: 2, failed: 0 });
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@x.io', subject: 'Hi A', html: expect.stringContaining('Body for A'),
    }));
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'b@x.io', subject: 'Hi B', html: expect.stringContaining('Body for B'),
    }));
  });

  it('returns skipped for an unknown id', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const result = await sendScheduledAnnouncement(makeDeps(db, provider), 'nope');
    expect(result).toEqual({ outcome: 'skipped', sent: 0, failed: 0 });
  });
});

describe('runDueAnnouncements', () => {
  it('ignores rows scheduled in the future', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    scheduleAnnouncement(db, { subject: 'Hi', body: 'B', recipientEmails: ['a@x.io'], scheduledAt: future });
    const summary = await runDueAnnouncements(makeDeps(db, provider));
    expect(summary).toEqual({ due: 0, sent: 0, failed: 0, skipped: 0 });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('sends all due rows in scheduledAt order and tallies outcomes', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const now = new Date();
    scheduleAnnouncement(db, { subject: 'First', body: 'B', recipientEmails: ['a@x.io'], scheduledAt: new Date(now.getTime() - 2000) });
    scheduleAnnouncement(db, { subject: 'Second', body: 'B', recipientEmails: ['inactive@x.io'], scheduledAt: new Date(now.getTime() - 1000) });
    const summary = await runDueAnnouncements(makeDeps(db, provider), now);
    expect(summary).toEqual({ due: 2, sent: 1, failed: 1, skipped: 0 });
  });

  it('one failing row does not stop the next from sending', async () => {
    const db = makeDb();
    const { provider } = fakes();
    const now = new Date();
    scheduleAnnouncement(db, { subject: 'Bad', body: 'B', recipientEmails: ['inactive@x.io'], scheduledAt: new Date(now.getTime() - 2000) });
    scheduleAnnouncement(db, { subject: 'Good', body: 'B', recipientEmails: ['a@x.io'], scheduledAt: new Date(now.getTime() - 1000) });
    const summary = await runDueAnnouncements(makeDeps(db, provider), now);
    expect(summary.due).toBe(2);
    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(1);
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
});
