import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { announcements } from '../schema';
import {
  scheduleAnnouncement,
  updateScheduledAnnouncement,
  cancelScheduledAnnouncement,
  listScheduledAnnouncements,
} from './schedule';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

describe('scheduleAnnouncement', () => {
  it('inserts a scheduled row with the expected shape', () => {
    const db = makeDb();
    const scheduledAt = new Date('2026-10-01T21:00:00Z');
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io', 'b@x.io'], scheduledAt,
    });
    expect(id).toBeTruthy();
    const [row] = db.select().from(announcements).all();
    expect(row.id).toBe(id);
    expect(row.subject).toBe('Hi');
    expect(row.body).toBe('Body');
    expect(JSON.parse(row.recipientEmails)).toEqual(['a@x.io', 'b@x.io']);
    expect(row.status).toBe('scheduled');
    expect(row.renderedHtml).toBeNull();
    expect(row.scheduledAt).toEqual(scheduledAt);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.sentAt).toBeNull();
  });
});

describe('updateScheduledAnnouncement', () => {
  it('updates a scheduled row and returns true', () => {
    const db = makeDb();
    const scheduledAt = new Date('2026-10-01T21:00:00Z');
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], scheduledAt,
    });
    const newScheduledAt = new Date('2026-10-02T21:00:00Z');
    const result = updateScheduledAnnouncement(db, id, {
      subject: 'Updated', body: 'New body', recipientEmails: ['b@x.io'], scheduledAt: newScheduledAt,
    });
    expect(result).toBe(true);
    const [row] = db.select().from(announcements).all();
    expect(row.subject).toBe('Updated');
    expect(row.body).toBe('New body');
    expect(JSON.parse(row.recipientEmails)).toEqual(['b@x.io']);
    expect(row.scheduledAt).toEqual(newScheduledAt);
  });

  it('returns false and makes no change when the row is not scheduled', () => {
    const db = makeDb();
    const scheduledAt = new Date('2026-10-01T21:00:00Z');
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], scheduledAt,
    });
    cancelScheduledAnnouncement(db, id);
    const result = updateScheduledAnnouncement(db, id, {
      subject: 'Updated', body: 'New body', recipientEmails: ['b@x.io'], scheduledAt,
    });
    expect(result).toBe(false);
    const [row] = db.select().from(announcements).all();
    expect(row.subject).toBe('Hi');
    expect(row.status).toBe('cancelled');
  });

  it('returns false for an unknown id', () => {
    const db = makeDb();
    const result = updateScheduledAnnouncement(db, 'nope', {
      subject: 'Updated', body: 'New body', recipientEmails: ['b@x.io'], scheduledAt: new Date(),
    });
    expect(result).toBe(false);
  });
});

describe('cancelScheduledAnnouncement', () => {
  it('cancels a scheduled row and returns true', () => {
    const db = makeDb();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], scheduledAt: new Date(),
    });
    const result = cancelScheduledAnnouncement(db, id);
    expect(result).toBe(true);
    const [row] = db.select().from(announcements).all();
    expect(row.status).toBe('cancelled');
  });

  it('returns false when the row is already cancelled', () => {
    const db = makeDb();
    const id = scheduleAnnouncement(db, {
      subject: 'Hi', body: 'Body', recipientEmails: ['a@x.io'], scheduledAt: new Date(),
    });
    cancelScheduledAnnouncement(db, id);
    const result = cancelScheduledAnnouncement(db, id);
    expect(result).toBe(false);
  });

  it('returns false for an unknown id', () => {
    const db = makeDb();
    const result = cancelScheduledAnnouncement(db, 'nope');
    expect(result).toBe(false);
  });
});

describe('listScheduledAnnouncements', () => {
  it('lists only scheduled rows ordered by scheduledAt ascending', () => {
    const db = makeDb();
    const later = scheduleAnnouncement(db, {
      subject: 'Later', body: 'B', recipientEmails: ['a@x.io'], scheduledAt: new Date('2026-10-05T00:00:00Z'),
    });
    const sooner = scheduleAnnouncement(db, {
      subject: 'Sooner', body: 'B', recipientEmails: ['a@x.io'], scheduledAt: new Date('2026-10-01T00:00:00Z'),
    });
    const cancelledId = scheduleAnnouncement(db, {
      subject: 'Cancelled', body: 'B', recipientEmails: ['a@x.io'], scheduledAt: new Date('2026-09-30T00:00:00Z'),
    });
    cancelScheduledAnnouncement(db, cancelledId);

    const rows = listScheduledAnnouncements(db);
    expect(rows.map(r => r.id)).toEqual([sooner, later]);
    expect(rows.every(r => r.status === 'scheduled')).toBe(true);
  });
});
