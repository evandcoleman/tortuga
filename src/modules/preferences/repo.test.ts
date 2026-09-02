import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientPreferences } from './schema';
import { getPreferences, upsertPreferences, setCategory } from './repo';

const db = createDb(':memory:');
applyMigrations(db);

beforeEach(() => {
  db.delete(recipientPreferences).run();
});

describe('getPreferences', () => {
  it('returns defaults when no row exists', () => {
    expect(getPreferences(db, 'nobody@x.io')).toEqual({
      digest: true, announcements: true, libraries: null,
    });
  });

  it('returns the stored row when present', () => {
    upsertPreferences(db, 'a@x.io', { digest: false, announcements: true, libraries: ['Movies'] });
    expect(getPreferences(db, 'a@x.io')).toEqual({
      digest: false, announcements: true, libraries: ['Movies'],
    });
  });
});

describe('upsertPreferences', () => {
  it('inserts a new row with partial fields merged onto defaults', () => {
    upsertPreferences(db, 'a@x.io', { digest: false });
    expect(getPreferences(db, 'a@x.io')).toEqual({
      digest: false, announcements: true, libraries: null,
    });
  });

  it('merges onto the existing row rather than overwriting untouched fields', () => {
    upsertPreferences(db, 'a@x.io', { digest: false, libraries: ['Movies'] });
    upsertPreferences(db, 'a@x.io', { announcements: false });
    expect(getPreferences(db, 'a@x.io')).toEqual({
      digest: false, announcements: false, libraries: ['Movies'],
    });
  });

  it('does not mutate the partial input object', () => {
    const input = { digest: false };
    const frozen = { ...input };
    upsertPreferences(db, 'a@x.io', input);
    expect(input).toEqual(frozen);
  });
});

describe('setCategory', () => {
  it('flips a single category to false without touching the other', () => {
    setCategory(db, 'a@x.io', 'digest', false);
    expect(getPreferences(db, 'a@x.io')).toEqual({
      digest: false, announcements: true, libraries: null,
    });
  });

  it('flips a category back to true on an existing row', () => {
    setCategory(db, 'a@x.io', 'announcements', false);
    setCategory(db, 'a@x.io', 'announcements', true);
    expect(getPreferences(db, 'a@x.io')).toEqual({
      digest: true, announcements: true, libraries: null,
    });
  });
});
