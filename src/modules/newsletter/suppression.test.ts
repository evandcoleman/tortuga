import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { sends, recipientsCache } from './schema';
import { createId } from '@paralleldrive/cuid2';
import { suppressRecipient, suppressRecipientForSend } from './suppression';

const db = createDb(':memory:');
applyMigrations(db);

beforeEach(() => {
  db.delete(sends).run();
  db.delete(recipientsCache).run();
});

describe('suppressRecipient', () => {
  it('deactivates a cached recipient by email', () => {
    db.insert(recipientsCache).values({
      email: 'a@b.io', name: 'A', lastSynced: new Date(), active: true,
    }).run();

    suppressRecipient(db, 'a@b.io', 'bounce');

    const row = db.select().from(recipientsCache).all()[0];
    expect(row.active).toBe(false);
    expect(row.suppressedReason).toBe('bounce');
  });

  it('does nothing when the email is not cached', () => {
    expect(() => suppressRecipient(db, 'missing@b.io', 'bounce')).not.toThrow();
    expect(db.select().from(recipientsCache).all()).toHaveLength(0);
  });
});

describe('suppressRecipientForSend', () => {
  it('deactivates the recipient tied to a matching send row', () => {
    db.insert(recipientsCache).values({
      email: 'a@b.io', name: 'A', lastSynced: new Date(), active: true,
    }).run();
    db.insert(sends).values({
      id: createId(), recipientEmail: 'a@b.io', recipientName: 'A',
      providerMessageId: 'msg_abc', provider: 'mailgun', status: 'sent',
    }).run();

    suppressRecipientForSend(db, { provider: 'mailgun', providerMessageId: 'msg_abc', reason: 'complaint' });

    const row = db.select().from(recipientsCache).all()[0];
    expect(row.active).toBe(false);
    expect(row.suppressedReason).toBe('complaint');
  });

  it('does nothing when no send matches the provider + message id', () => {
    db.insert(recipientsCache).values({
      email: 'a@b.io', name: 'A', lastSynced: new Date(), active: true,
    }).run();

    expect(() => suppressRecipientForSend(db, { provider: 'mailgun', providerMessageId: 'nope', reason: 'bounce' })).not.toThrow();

    const row = db.select().from(recipientsCache).all()[0];
    expect(row.active).toBe(true);
  });

  it('does not cross providers when message ids collide', () => {
    db.insert(recipientsCache).values({
      email: 'a@b.io', name: 'A', lastSynced: new Date(), active: true,
    }).run();
    db.insert(sends).values({
      id: createId(), recipientEmail: 'a@b.io', recipientName: 'A',
      providerMessageId: 'shared-id', provider: 'resend', status: 'sent',
    }).run();

    suppressRecipientForSend(db, { provider: 'mailgun', providerMessageId: 'shared-id', reason: 'bounce' });

    const row = db.select().from(recipientsCache).all()[0];
    expect(row.active).toBe(true);
  });
});
