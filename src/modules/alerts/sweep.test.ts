import { describe, it, expect } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { announcements } from '@/modules/announcements/schema';
import { digests, sends, sendEvents } from '@/modules/newsletter/schema';

import { alerts } from './schema';
import { sweepAlerts } from './sweep';
import { REJECTION_SPIKE_MIN, BOUNCE_SPIKE_MIN, SWEEP_LOOKBACK_MS } from './conditions';

const TIMEZONE = 'UTC';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

function insertDigest(db: ReturnType<typeof createDb>, overrides: Partial<typeof digests.$inferInsert> = {}) {
  const id = createId();
  const now = new Date();
  db.insert(digests).values({
    id,
    scheduledAt: now,
    windowStart: now,
    windowEnd: now,
    status: 'failed',
    error: 'boom',
    ...overrides,
  }).run();
  return id;
}

function insertAnnouncement(db: ReturnType<typeof createDb>, overrides: Partial<typeof announcements.$inferInsert> = {}) {
  const id = createId();
  const now = new Date();
  db.insert(announcements).values({
    id,
    subject: 'S',
    body: 'B',
    recipientEmails: '[]',
    status: 'failed',
    createdAt: now,
    error: 'kaboom',
    ...overrides,
  }).run();
  return id;
}

function insertFailedSend(db: ReturnType<typeof createDb>, sentAt: Date) {
  db.insert(sends).values({
    id: createId(),
    recipientEmail: 'x@x.io',
    recipientName: 'X',
    status: 'failed',
    sentAt,
  }).run();
}

function insertSendEvent(db: ReturnType<typeof createDb>, type: string, receivedAt: Date) {
  db.insert(sendEvents).values({
    id: createId(),
    type,
    receivedAt,
    payload: '{}',
  }).run();
}

describe('sweepAlerts', () => {
  it('creates one alert for a failed digest', () => {
    const db = makeDb();
    insertDigest(db);
    const { created } = sweepAlerts(db, { timezone: TIMEZONE });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'digest_failed', title: 'Digest failed', detail: 'boom' });
  });

  it('creates one alert for a failed announcement, titled "Announcement failed"', () => {
    const db = makeDb();
    insertAnnouncement(db, { status: 'failed' });
    const { created } = sweepAlerts(db, { timezone: TIMEZONE });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'announcement_failed', title: 'Announcement failed' });
  });

  it('titles a partial announcement differently from a failed one', () => {
    const db = makeDb();
    insertAnnouncement(db, { status: 'partial' });
    const { created } = sweepAlerts(db, { timezone: TIMEZONE });
    expect(created).toHaveLength(1);
    expect(created[0].title).toBe('Announcement partially sent');
  });

  it('creates a rejection_spike alert once the threshold is met', () => {
    const db = makeDb();
    const now = new Date();
    for (let i = 0; i < REJECTION_SPIKE_MIN; i++) insertFailedSend(db, now);
    const { created } = sweepAlerts(db, { now, timezone: TIMEZONE });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'rejection_spike' });
    expect(created[0].detail).toBe(String(REJECTION_SPIKE_MIN));
  });

  it('creates nothing below the rejection spike threshold', () => {
    const db = makeDb();
    const now = new Date();
    for (let i = 0; i < REJECTION_SPIKE_MIN - 1; i++) insertFailedSend(db, now);
    const { created } = sweepAlerts(db, { now, timezone: TIMEZONE });
    expect(created).toHaveLength(0);
  });

  it('creates a bounce_spike alert once the threshold is met', () => {
    const db = makeDb();
    const now = new Date();
    for (let i = 0; i < BOUNCE_SPIKE_MIN; i++) insertSendEvent(db, 'bounced', now);
    const { created } = sweepAlerts(db, { now, timezone: TIMEZONE });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'bounce_spike' });
  });

  it('creates nothing below the bounce spike threshold', () => {
    const db = makeDb();
    const now = new Date();
    for (let i = 0; i < BOUNCE_SPIKE_MIN - 1; i++) insertSendEvent(db, 'bounced', now);
    const { created } = sweepAlerts(db, { now, timezone: TIMEZONE });
    expect(created).toHaveLength(0);
  });

  it('creates one alert per complaint event', () => {
    const db = makeDb();
    const now = new Date();
    insertSendEvent(db, 'complained', now);
    const { created } = sweepAlerts(db, { now, timezone: TIMEZONE });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'complaint', title: 'Spam complaint received' });
  });

  it('re-running creates no new alerts and refreshes detail', () => {
    const db = makeDb();
    const id = insertDigest(db, { error: 'first error' });
    const first = sweepAlerts(db, { timezone: TIMEZONE });
    expect(first.created).toHaveLength(1);

    db.update(digests).set({ error: 'second error' }).where(eq(digests.id, id)).run();
    const second = sweepAlerts(db, { timezone: TIMEZONE });
    expect(second.created).toHaveLength(0);

    const rows = db.select().from(alerts).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toBe('second error');
  });

  it('ignores rows older than the sweep lookback window', () => {
    const db = makeDb();
    const old = new Date(Date.now() - SWEEP_LOOKBACK_MS - 60_000);
    insertDigest(db, { scheduledAt: old });
    insertAnnouncement(db, { createdAt: old });
    const { created } = sweepAlerts(db, { timezone: TIMEZONE });
    expect(created).toHaveLength(0);
  });

  it('ignores complaint events older than the sweep lookback window', () => {
    const db = makeDb();
    const old = new Date(Date.now() - SWEEP_LOOKBACK_MS - 60_000);
    insertSendEvent(db, 'complained', old);
    const { created } = sweepAlerts(db, { timezone: TIMEZONE });
    expect(created).toHaveLength(0);
  });
});
