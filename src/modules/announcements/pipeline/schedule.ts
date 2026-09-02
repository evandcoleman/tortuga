import { createId } from '@paralleldrive/cuid2';
import { and, asc, eq } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';

import { announcements } from '../schema';

export interface ScheduleAnnouncementInput {
  subject: string;
  body: string;
  recipientEmails: string[];
  scheduledAt: Date;
}

export interface UpdateScheduledAnnouncementInput {
  subject: string;
  body: string;
  recipientEmails: string[];
  scheduledAt: Date;
}

/** Inserts a `scheduled` announcement row. Recipients are re-resolved at send time. */
export function scheduleAnnouncement(db: Db, input: ScheduleAnnouncementInput): string {
  const id = createId();
  db.insert(announcements).values({
    id,
    subject: input.subject,
    body: input.body,
    recipientEmails: JSON.stringify(input.recipientEmails),
    status: 'scheduled',
    renderedHtml: null,
    createdAt: new Date(),
    scheduledAt: input.scheduledAt,
  }).run();
  return id;
}

/**
 * Updates a still-`scheduled` row. Returns false without changing anything if
 * the row is missing or has already moved past `scheduled` (e.g. the runner
 * claimed it, or it was already cancelled) — a caller racing the runner
 * loses this guard rather than corrupting an in-flight or finished send.
 */
export function updateScheduledAnnouncement(
  db: Db,
  id: string,
  input: UpdateScheduledAnnouncementInput,
): boolean {
  const result = db.update(announcements)
    .set({
      subject: input.subject,
      body: input.body,
      recipientEmails: JSON.stringify(input.recipientEmails),
      scheduledAt: input.scheduledAt,
    })
    .where(and(eq(announcements.id, id), eq(announcements.status, 'scheduled')))
    .run();
  return result.changes > 0;
}

/** Cancels a still-`scheduled` row. Same guard as {@link updateScheduledAnnouncement}. */
export function cancelScheduledAnnouncement(db: Db, id: string): boolean {
  const result = db.update(announcements)
    .set({ status: 'cancelled' })
    .where(and(eq(announcements.id, id), eq(announcements.status, 'scheduled')))
    .run();
  return result.changes > 0;
}

/** All pending scheduled announcements, soonest first. */
export function listScheduledAnnouncements(db: Db) {
  return db.select().from(announcements)
    .where(eq(announcements.status, 'scheduled'))
    .orderBy(asc(announcements.scheduledAt))
    .all();
}
