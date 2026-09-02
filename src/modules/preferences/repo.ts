import { eq } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';

import { recipientPreferences } from './schema';

export type MessageCategory = 'digest' | 'announcements';

export interface Preferences {
  digest: boolean;
  announcements: boolean;
  libraries: string[] | null;
}

const DEFAULT_PREFERENCES: Preferences = { digest: true, announcements: true, libraries: null };

function parseLibraries(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

/** Returns a recipient's message preferences, defaulting to opted-in-to-everything when no row exists. */
export function getPreferences(db: Db, email: string): Preferences {
  const row = db.select().from(recipientPreferences).where(eq(recipientPreferences.email, email)).get();
  if (!row) return DEFAULT_PREFERENCES;
  return { digest: row.digest, announcements: row.announcements, libraries: parseLibraries(row.libraries) };
}

/** Merges `partial` onto the recipient's existing preferences (or defaults) and upserts the row. */
export function upsertPreferences(db: Db, email: string, partial: Partial<Preferences>): Preferences {
  const current = getPreferences(db, email);
  const next: Preferences = { ...current, ...partial };
  const now = new Date();
  db.insert(recipientPreferences).values({
    email,
    digest: next.digest,
    announcements: next.announcements,
    libraries: next.libraries === null ? null : JSON.stringify(next.libraries),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: recipientPreferences.email,
    set: {
      digest: next.digest,
      announcements: next.announcements,
      libraries: next.libraries === null ? null : JSON.stringify(next.libraries),
      updatedAt: now,
    },
  }).run();
  return next;
}

/** Opts a recipient in or out of a single message category, leaving the other category and libraries untouched. */
export function setCategory(db: Db, email: string, category: MessageCategory, enabled: boolean): Preferences {
  return upsertPreferences(db, email, { [category]: enabled });
}
