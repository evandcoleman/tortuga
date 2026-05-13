import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import type { TautulliClient } from '@/kernel/integrations/tautulli';
import { recipientsCache } from '../schema';

export async function syncRecipients(db: Db, tautulli: TautulliClient) {
  const users = await tautulli.getUsers();
  let synced = 0;
  let skippedNoEmail = 0;
  for (const u of users) {
    if (!u.email) { skippedNoEmail++; continue; }
    const existing = db.select().from(recipientsCache).where(eq(recipientsCache.email, u.email)).all();
    if (existing.length === 0) {
      db.insert(recipientsCache).values({
        email: u.email, name: u.name, plexUsername: u.plexUsername,
        lastSynced: new Date(), active: true,
      }).run();
    } else {
      db.update(recipientsCache).set({
        name: u.name, plexUsername: u.plexUsername, lastSynced: new Date(),
      }).where(eq(recipientsCache.email, u.email)).run();
    }
    synced++;
  }
  return { synced, skippedNoEmail };
}
