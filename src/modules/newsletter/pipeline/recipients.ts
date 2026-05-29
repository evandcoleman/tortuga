import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import type { TautulliClient } from '@/kernel/integrations/tautulli';
import { recipientsCache } from '../schema';

type RecipientSource = 'plex' | 'manual';

export async function syncRecipients(db: Db, tautulli: TautulliClient) {
  const users = await tautulli.getUsers();
  let synced = 0;
  let skippedNoEmail = 0;
  for (const u of users) {
    if (!u.email) { skippedNoEmail++; continue; }
    const existing = db.select().from(recipientsCache).where(eq(recipientsCache.email, u.email)).get();
    if (!existing) {
      db.insert(recipientsCache).values({
        email: u.email, name: u.name, plexUsername: u.plexUsername,
        lastSynced: new Date(), active: true, source: 'plex',
      }).run();
      synced++;
      continue;
    }
    // Never let a Plex sync clobber a manually-managed recipient. Manual rows
    // are the local-only overlay and Plex is not their source of truth.
    if (existing.source === 'manual') continue;
    db.update(recipientsCache).set({
      name: u.name, plexUsername: u.plexUsername, lastSynced: new Date(),
    }).where(eq(recipientsCache.email, u.email)).run();
    synced++;
  }
  return { synced, skippedNoEmail };
}

/** Return all cached recipients whose `source` matches. Exported for testing/filtering UI. */
export function getRecipientsBySource(db: Db, source: RecipientSource) {
  return db.select().from(recipientsCache).where(eq(recipientsCache.source, source)).all();
}

/**
 * Add (or reactivate) a single manual recipient. Idempotent: if the email
 * already exists it is reactivated and its name updated, and the row is marked
 * `manual` so future Plex syncs leave it alone. Returns whether a new row was
 * created. No mutation of caller data; only DB writes.
 */
export function addManualRecipient(
  db: Db,
  email: string,
  name: string,
): { created: boolean; reactivated: boolean } {
  const existing = db.select().from(recipientsCache).where(eq(recipientsCache.email, email)).get();
  const now = new Date();
  if (!existing) {
    db.insert(recipientsCache).values({
      email, name, plexUsername: null, lastSynced: now, active: true, source: 'manual',
    }).run();
    return { created: true, reactivated: false };
  }
  const reactivated = !existing.active;
  db.update(recipientsCache).set({
    name, active: true, source: 'manual', lastSynced: now,
  }).where(eq(recipientsCache.email, email)).run();
  return { created: false, reactivated };
}

/**
 * Soft-delete a recipient by marking it inactive. Preserves the row so history
 * and unsubscribe semantics stay intact. Returns whether a matching row existed.
 */
export function removeRecipient(db: Db, email: string): { removed: boolean } {
  const existing = db.select().from(recipientsCache).where(eq(recipientsCache.email, email)).get();
  if (!existing) return { removed: false };
  db.update(recipientsCache).set({ active: false }).where(eq(recipientsCache.email, email)).run();
  return { removed: true };
}

export interface ImportResult {
  added: number;
  reactivated: number;
  skippedExisting: number;
}

/**
 * Import many already-validated, already-deduped emails as manual recipients.
 * Each email reuses {@link addManualRecipient} so reactivation behavior is
 * consistent. Caller is responsible for validation/dedup (see import schema).
 */
export function importManualRecipients(
  db: Db,
  entries: ReadonlyArray<{ email: string; name: string }>,
): ImportResult {
  return entries.reduce<ImportResult>(
    (acc, entry) => {
      const existed = db.select().from(recipientsCache).where(eq(recipientsCache.email, entry.email)).get();
      const { created, reactivated } = addManualRecipient(db, entry.email, entry.name);
      if (created) return { ...acc, added: acc.added + 1 };
      if (reactivated) return { ...acc, reactivated: acc.reactivated + 1 };
      // existing active row: counted as a no-op skip
      return existed?.active ? { ...acc, skippedExisting: acc.skippedExisting + 1 } : acc;
    },
    { added: 0, reactivated: 0, skippedExisting: 0 },
  );
}
