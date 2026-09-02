import { describe, it, expect } from 'vitest';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache } from '@/modules/newsletter/schema';

import { announcements } from '../schema';
import { cloneSource } from './clone-source';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

function seedRecipients(db: ReturnType<typeof createDb>) {
  db.insert(recipientsCache).values([
    { email: 'a@x.io', name: 'A', lastSynced: new Date(), active: true },
    { email: 'b@x.io', name: 'B', lastSynced: new Date(), active: true },
    { email: 'inactive@x.io', name: 'Inactive', lastSynced: new Date(), active: false },
  ]).run();
}

function seedAnnouncement(
  db: ReturnType<typeof createDb>,
  overrides: Partial<{ id: string; subject: string; body: string; recipientEmails: string[]; status: string }> = {},
) {
  const id = overrides.id ?? 'ann-1';
  db.insert(announcements).values({
    id,
    subject: overrides.subject ?? 'Hi {{name}}',
    body: overrides.body ?? 'Body {{name}}',
    recipientEmails: JSON.stringify(overrides.recipientEmails ?? ['a@x.io', 'b@x.io']),
    status: (overrides.status as 'sent') ?? 'sent',
    createdAt: new Date(),
  }).run();
  return id;
}

describe('cloneSource', () => {
  it('returns prefill for an existing row', () => {
    const db = makeDb();
    seedRecipients(db);
    const id = seedAnnouncement(db, { subject: 'Subject', body: 'Body text', recipientEmails: ['a@x.io', 'b@x.io'] });
    const result = cloneSource(db, id);
    expect(result).toEqual({ subject: 'Subject', body: 'Body text', recipientEmails: ['a@x.io', 'b@x.io'] });
  });

  it('returns null for an unknown id', () => {
    const db = makeDb();
    expect(cloneSource(db, 'nope')).toBeNull();
  });

  it('filters recipients to those currently active', () => {
    const db = makeDb();
    seedRecipients(db);
    const id = seedAnnouncement(db, { recipientEmails: ['a@x.io', 'inactive@x.io', 'unknown@x.io'] });
    const result = cloneSource(db, id);
    expect(result?.recipientEmails).toEqual(['a@x.io']);
  });

  it('reads a row regardless of status', () => {
    const db = makeDb();
    seedRecipients(db);
    const id = seedAnnouncement(db, { status: 'scheduled', recipientEmails: ['a@x.io'] });
    const result = cloneSource(db, id);
    expect(result?.recipientEmails).toEqual(['a@x.io']);
  });
});
