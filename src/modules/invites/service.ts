import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';

import { invites } from './schema';

export type Invite = typeof invites.$inferSelect;
export type InviteStatus = Invite['status'];

export function listInvites(db: Db): Invite[] {
  return db.select().from(invites).all();
}

export function getInviteByEmail(db: Db, email: string): Invite | null {
  const row = db.select().from(invites).where(eq(invites.email, email)).get();
  return row ?? null;
}

/**
 * Records a successful Plex invite. Always resets the row to `pending` with
 * a fresh `sentAt`/`sectionIds` and a cleared `welcomeSentAt` — a successful
 * plex.tv invite means a fresh invite happened there regardless of any prior
 * local state (including a previously-cancelled row, per spec).
 */
export function upsertInviteAfterPlexInvite(db: Db, email: string, sectionIds: string[]): Invite {
  const now = new Date();
  const row: Invite = {
    email,
    sectionIds: JSON.stringify(sectionIds),
    sentAt: now,
    welcomeSentAt: null,
    status: 'pending',
  };
  db.insert(invites).values(row)
    .onConflictDoUpdate({
      target: invites.email,
      set: { sectionIds: row.sectionIds, sentAt: row.sentAt, welcomeSentAt: null, status: 'pending' },
    })
    .run();
  return row;
}

export function markWelcomeSent(db: Db, email: string, at: Date = new Date()): void {
  db.update(invites).set({ welcomeSentAt: at }).where(eq(invites.email, email)).run();
}

/** Called by the Tautulli sync when a newly-synced recipient matches a known invite. */
export function markInviteAccepted(db: Db, email: string): void {
  db.update(invites).set({ status: 'accepted' }).where(eq(invites.email, email)).run();
}

export function markInviteCancelled(db: Db, email: string): void {
  db.update(invites).set({ status: 'cancelled' }).where(eq(invites.email, email)).run();
}

export function parseSectionIds(invite: Pick<Invite, 'sectionIds'>): string[] {
  try {
    const parsed = JSON.parse(invite.sectionIds);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
