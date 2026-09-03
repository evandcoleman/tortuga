import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';

import { alerts, type Alert } from './schema';
import { allSweepCandidates, type AlertCandidate } from './conditions';

export interface SweepAlertsOptions {
  now?: Date;
  timezone: string;
}

export interface SweepAlertsResult {
  created: Alert[];
}

/**
 * Inserts a candidate, or refreshes `detail`/`updated_at` on the existing
 * row for its key if one already exists. Returns the resulting row plus
 * whether this call created it (vs. refreshed an existing row).
 */
export function upsertAlert(db: Db, candidate: AlertCandidate, now: Date): { row: Alert; created: boolean } {
  const id = createId();
  db.insert(alerts).values({
    id,
    kind: candidate.kind,
    key: candidate.key,
    title: candidate.title,
    detail: candidate.detail,
    href: candidate.href,
    createdAt: now,
    updatedAt: now,
    acknowledgedAt: null,
    emailedAt: null,
    emailAttempts: 0,
  })
    .onConflictDoUpdate({
      target: alerts.key,
      set: { title: candidate.title, detail: candidate.detail, href: candidate.href, updatedAt: now },
    })
    .run();
  const row = db.select().from(alerts).where(eq(alerts.key, candidate.key)).all()[0];
  return { row, created: row.id === id };
}

/**
 * Computes candidates from every condition and upserts each. Pure DB: no
 * email, no scheduler context. Returns only the rows created by this sweep
 * (i.e. `created_at` was just set), which is what the caller emails.
 */
export function sweepAlerts(db: Db, options: SweepAlertsOptions): SweepAlertsResult {
  const now = options.now ?? new Date();
  const candidates = allSweepCandidates(db, { now, timezone: options.timezone });

  const created: Alert[] = [];
  for (const candidate of candidates) {
    const { row, created: wasCreated } = upsertAlert(db, candidate, now);
    if (wasCreated) created.push(row);
  }
  return { created };
}
