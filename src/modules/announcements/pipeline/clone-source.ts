import { eq } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';
import { recipientsCache } from '@/modules/newsletter/schema';

import { announcements } from '../schema';

export interface CloneSourceResult {
  subject: string;
  body: string;
  recipientEmails: string[];
}

/**
 * Prefill data for "use as starting point" on a previous send: subject,
 * body, and recipients intersected with the currently active recipient list.
 * Reads an announcement row regardless of status. Returns `null` when the
 * id does not exist so the caller can fall back to a blank composer.
 */
export function cloneSource(db: Db, id: string): CloneSourceResult | null {
  const [row] = db.select().from(announcements).where(eq(announcements.id, id)).all();
  if (!row) return null;

  const activeEmails = new Set(
    db.select({ email: recipientsCache.email }).from(recipientsCache)
      .where(eq(recipientsCache.active, true))
      .all()
      .map(r => r.email),
  );
  const recipientEmails: string[] = JSON.parse(row.recipientEmails)
    .filter((email: string) => activeEmails.has(email));

  return { subject: row.subject, body: row.body, recipientEmails };
}
