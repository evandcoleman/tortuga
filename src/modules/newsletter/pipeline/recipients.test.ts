import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import {
  syncRecipients,
  getRecipientsBySource,
  addManualRecipient,
  removeRecipient,
  importManualRecipients,
} from './recipients';
import { recipientsCache } from '../schema';
import { upsertInviteAfterPlexInvite, markWelcomeSent, getInviteByEmail } from '@/modules/invites/service';
import type { TautulliClient } from '@/kernel/integrations/tautulli';

function freshDb(): Db {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

function rowFor(db: Db, email: string) {
  return db.select().from(recipientsCache).where(eq(recipientsCache.email, email)).get();
}

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

  it('sets source=plex on new rows from Plex', async () => {
    // Arrange
    const db = freshDb();
    const tautulli = {
      getUsers: async () => [{ plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' }],
    } as any;

    // Act
    await syncRecipients(db, tautulli);

    // Assert
    expect(rowFor(db, 'a@x.io')?.source).toBe('plex');
  });

  it('preserves manually-added rows and does not update them during sync', async () => {
    // Arrange
    const db = freshDb();
    addManualRecipient(db, 'manual@x.io', 'Manual Person');
    const tautulli = {
      getUsers: async () => [
        { plexUserId: 9, name: 'Plex Clobber', plexUsername: 'pc', email: 'manual@x.io' },
      ],
    } as any;

    // Act
    const result = await syncRecipients(db, tautulli);

    // Assert: the manual row is untouched by sync
    const row = rowFor(db, 'manual@x.io');
    expect(row?.source).toBe('manual');
    expect(row?.name).toBe('Manual Person');
    expect(row?.plexUsername).toBeNull();
    expect(result.synced).toBe(0);
  });
});

describe('getRecipientsBySource', () => {
  it('returns only rows matching the requested source', () => {
    // Arrange
    const db = freshDb();
    db.insert(recipientsCache).values({
      email: 'p@x.io', name: 'P', plexUsername: 'p', lastSynced: new Date(), active: true, source: 'plex',
    }).run();
    addManualRecipient(db, 'm@x.io', 'M');

    // Act
    const manual = getRecipientsBySource(db, 'manual');
    const plex = getRecipientsBySource(db, 'plex');

    // Assert
    expect(manual.map(r => r.email)).toEqual(['m@x.io']);
    expect(plex.map(r => r.email)).toEqual(['p@x.io']);
  });
});

describe('addManualRecipient', () => {
  it('creates a new active manual row', () => {
    // Arrange
    const db = freshDb();

    // Act
    const res = addManualRecipient(db, 'new@x.io', 'New');

    // Assert
    expect(res).toEqual({ created: true, reactivated: false });
    const row = rowFor(db, 'new@x.io');
    expect(row?.active).toBe(true);
    expect(row?.source).toBe('manual');
  });

  it('reactivates and reclaims a previously removed row', () => {
    // Arrange
    const db = freshDb();
    addManualRecipient(db, 'x@x.io', 'X');
    removeRecipient(db, 'x@x.io');

    // Act
    const res = addManualRecipient(db, 'x@x.io', 'X Again');

    // Assert
    expect(res).toEqual({ created: false, reactivated: true });
    const row = rowFor(db, 'x@x.io');
    expect(row?.active).toBe(true);
    expect(row?.name).toBe('X Again');
  });

  it('marks a previously plex-sourced row as manual when added by hand', () => {
    // Arrange
    const db = freshDb();
    db.insert(recipientsCache).values({
      email: 'p@x.io', name: 'P', plexUsername: 'p', lastSynced: new Date(), active: true, source: 'plex',
    }).run();

    // Act
    addManualRecipient(db, 'p@x.io', 'P Manual');

    // Assert
    expect(rowFor(db, 'p@x.io')?.source).toBe('manual');
  });
});

describe('removeRecipient', () => {
  it('soft-deletes by setting active=false but keeps the row', () => {
    // Arrange
    const db = freshDb();
    addManualRecipient(db, 'r@x.io', 'R');

    // Act
    const res = removeRecipient(db, 'r@x.io');

    // Assert
    expect(res).toEqual({ removed: true });
    const row = rowFor(db, 'r@x.io');
    expect(row).toBeDefined();
    expect(row?.active).toBe(false);
  });

  it('reports removed=false for an unknown email', () => {
    // Arrange
    const db = freshDb();

    // Act
    const res = removeRecipient(db, 'ghost@x.io');

    // Assert
    expect(res).toEqual({ removed: false });
  });
});

describe('syncRecipients invite matching', () => {
  it('marks a matching invite accepted and copies welcomeSentAt onto the new recipient', async () => {
    const db = freshDb();
    upsertInviteAfterPlexInvite(db, 'welcomed@x.io', ['1001']);
    const sentAt = new Date(2026, 0, 1);
    markWelcomeSent(db, 'welcomed@x.io', sentAt);
    const tautulli = { getUsers: async () => [{ plexUserId: 1, name: 'W', plexUsername: 'w', email: 'welcomed@x.io' }] } as unknown as TautulliClient;

    await syncRecipients(db, tautulli);

    expect(rowFor(db, 'welcomed@x.io')?.welcomedAt).toEqual(sentAt);
    expect(getInviteByEmail(db, 'welcomed@x.io')?.status).toBe('accepted');
  });

  it('leaves welcomedAt null for a new recipient with no matching invite (invited outside Tortuga)', async () => {
    const db = freshDb();
    const tautulli = { getUsers: async () => [{ plexUserId: 1, name: 'Outside', plexUsername: 'o', email: 'outside@x.io' }] } as unknown as TautulliClient;

    await syncRecipients(db, tautulli);

    expect(rowFor(db, 'outside@x.io')?.welcomedAt).toBeNull();
  });

  it('leaves welcomedAt null when the matching invite has no welcomeSentAt yet (Plex succeeded, welcome email failed)', async () => {
    const db = freshDb();
    upsertInviteAfterPlexInvite(db, 'pending-welcome@x.io', ['1001']);
    const tautulli = { getUsers: async () => [{ plexUserId: 1, name: 'P', plexUsername: 'p', email: 'pending-welcome@x.io' }] } as unknown as TautulliClient;

    await syncRecipients(db, tautulli);

    expect(rowFor(db, 'pending-welcome@x.io')?.welcomedAt).toBeNull();
    expect(getInviteByEmail(db, 'pending-welcome@x.io')?.status).toBe('accepted');
  });
});

describe('importManualRecipients', () => {
  it('adds, reactivates, and skips existing active rows with accurate counts', () => {
    // Arrange
    const db = freshDb();
    addManualRecipient(db, 'active@x.io', 'Active');
    addManualRecipient(db, 'removed@x.io', 'Removed');
    removeRecipient(db, 'removed@x.io');

    // Act
    const result = importManualRecipients(db, [
      { email: 'fresh@x.io', name: 'Fresh' },
      { email: 'active@x.io', name: 'Active' },
      { email: 'removed@x.io', name: 'Removed' },
    ]);

    // Assert
    expect(result).toEqual({ added: 1, reactivated: 1, skippedExisting: 1 });
    expect(rowFor(db, 'fresh@x.io')?.source).toBe('manual');
    expect(rowFor(db, 'removed@x.io')?.active).toBe(true);
  });
});
