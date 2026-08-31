import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import {
  listInvites,
  getInviteByEmail,
  upsertInviteAfterPlexInvite,
  markWelcomeSent,
  markInviteAccepted,
  markInviteCancelled,
  parseSectionIds,
} from './service';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

describe('invites service', () => {
  it('creates a pending invite row with the given section ids', () => {
    const db = makeDb();
    const row = upsertInviteAfterPlexInvite(db, 'friend@example.com', ['1001', '1002']);
    expect(row.status).toBe('pending');
    expect(row.welcomeSentAt).toBeNull();
    expect(parseSectionIds(row)).toEqual(['1001', '1002']);
    expect(getInviteByEmail(db, 'friend@example.com')?.status).toBe('pending');
  });

  it('resets a cancelled invite back to pending on re-invite', () => {
    const db = makeDb();
    upsertInviteAfterPlexInvite(db, 'friend@example.com', ['1001']);
    markWelcomeSent(db, 'friend@example.com');
    markInviteCancelled(db, 'friend@example.com');
    expect(getInviteByEmail(db, 'friend@example.com')?.status).toBe('cancelled');

    const reInvited = upsertInviteAfterPlexInvite(db, 'friend@example.com', ['1001', '1002']);
    expect(reInvited.status).toBe('pending');
    expect(reInvited.welcomeSentAt).toBeNull();
    expect(parseSectionIds(reInvited)).toEqual(['1001', '1002']);
  });

  it('marks welcomeSentAt', () => {
    const db = makeDb();
    upsertInviteAfterPlexInvite(db, 'friend@example.com', ['1001']);
    const before = getInviteByEmail(db, 'friend@example.com');
    expect(before?.welcomeSentAt).toBeNull();
    markWelcomeSent(db, 'friend@example.com', new Date(2026, 0, 1));
    const after = getInviteByEmail(db, 'friend@example.com');
    expect(after?.welcomeSentAt).toEqual(new Date(2026, 0, 1));
  });

  it('marks an invite accepted', () => {
    const db = makeDb();
    upsertInviteAfterPlexInvite(db, 'friend@example.com', ['1001']);
    markInviteAccepted(db, 'friend@example.com');
    expect(getInviteByEmail(db, 'friend@example.com')?.status).toBe('accepted');
  });

  it('returns null for an unknown email', () => {
    const db = makeDb();
    expect(getInviteByEmail(db, 'nope@example.com')).toBeNull();
  });

  it('lists all invites', () => {
    const db = makeDb();
    upsertInviteAfterPlexInvite(db, 'a@example.com', ['1001']);
    upsertInviteAfterPlexInvite(db, 'b@example.com', ['1001']);
    expect(listInvites(db).map(i => i.email).sort()).toEqual(['a@example.com', 'b@example.com']);
  });

  it('parseSectionIds tolerates malformed JSON by returning an empty array', () => {
    expect(parseSectionIds({ sectionIds: 'not json' })).toEqual([]);
    expect(parseSectionIds({ sectionIds: '"a string"' })).toEqual([]);
  });
});
