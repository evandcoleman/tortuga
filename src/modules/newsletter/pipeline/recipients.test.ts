import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { syncRecipients } from './recipients';
import { recipientsCache } from '../schema';

describe('syncRecipients', () => {
  it('upserts users with non-null emails as active', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const tautulli = {
      getUsers: async () => [
        { plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' },
        { plexUserId: 2, name: 'B', plexUsername: 'b', email: null },
      ],
    } as any;
    const result = await syncRecipients(db, tautulli);
    expect(result.synced).toBe(1);
    expect(result.skippedNoEmail).toBe(1);
    const rows = db.select().from(recipientsCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(true);
  });

  it('preserves active=false for existing rows', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    db.insert(recipientsCache).values({
      email: 'a@x.io', name: 'old', plexUsername: 'a', lastSynced: new Date(0), active: false,
    }).run();
    const tautulli = { getUsers: async () => [{ plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' }] } as any;
    await syncRecipients(db, tautulli);
    const row = db.select().from(recipientsCache).all()[0];
    expect(row.active).toBe(false);
    expect(row.name).toBe('A');
  });
});
