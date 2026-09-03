import { and, eq, gte, or } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';
import { utcToWallClock } from '@/kernel/time/zoned';
import { announcements } from '@/modules/announcements/schema';
import { digests, sends, sendEvents } from '@/modules/newsletter/schema';

export const REJECTION_SPIKE_MIN = 3;
export const REJECTION_WINDOW_MS = 60 * 60 * 1000;
export const BOUNCE_SPIKE_MIN = 3;
export const BOUNCE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SWEEP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type AlertKind =
  | 'scheduler_error'
  | 'digest_failed'
  | 'announcement_failed'
  | 'rejection_spike'
  | 'bounce_spike'
  | 'complaint';

export interface AlertCandidate {
  kind: AlertKind;
  key: string;
  title: string;
  detail: string | null;
  href: string | null;
}

export interface ConditionContext {
  now: Date;
  timezone: string;
}

/** Calendar-day bucket in `timezone`, used to key noise-bounded alerts to one per day. */
function dayBucket(now: Date, timezone: string): string {
  return utcToWallClock(now, timezone).slice(0, 10);
}

function lookbackStart(now: Date): Date {
  return new Date(now.getTime() - SWEEP_LOOKBACK_MS);
}

export function digestFailedCandidates(db: Db, ctx: ConditionContext): AlertCandidate[] {
  const since = lookbackStart(ctx.now);
  const rows = db.select({ id: digests.id, error: digests.error })
    .from(digests)
    .where(and(eq(digests.status, 'failed'), gte(digests.scheduledAt, since)))
    .all();
  return rows.map(row => ({
    kind: 'digest_failed' as const,
    key: `digest:${row.id}`,
    title: 'Digest failed',
    detail: row.error ?? null,
    href: '/newsletter/history',
  }));
}

export function announcementFailedCandidates(db: Db, ctx: ConditionContext): AlertCandidate[] {
  const since = lookbackStart(ctx.now);
  const rows = db.select({ id: announcements.id, status: announcements.status, error: announcements.error })
    .from(announcements)
    .where(and(
      or(eq(announcements.status, 'failed'), eq(announcements.status, 'partial')),
      gte(announcements.createdAt, since),
    ))
    .all();
  return rows.map(row => ({
    kind: 'announcement_failed' as const,
    key: `announcement:${row.id}`,
    title: row.status === 'partial' ? 'Announcement partially sent' : 'Announcement failed',
    detail: row.error ?? null,
    href: `/messages/history/${row.id}`,
  }));
}

export function rejectionSpikeCandidates(db: Db, ctx: ConditionContext): AlertCandidate[] {
  const since = new Date(ctx.now.getTime() - REJECTION_WINDOW_MS);
  const rows = db.select({ id: sends.id })
    .from(sends)
    .where(and(eq(sends.status, 'failed'), gte(sends.sentAt, since)))
    .all();
  if (rows.length < REJECTION_SPIKE_MIN) return [];
  const day = dayBucket(ctx.now, ctx.timezone);
  return [{
    kind: 'rejection_spike',
    key: `rejections:${day}`,
    title: `${rows.length} sends rejected by the provider in the last hour`,
    detail: String(rows.length),
    href: null,
  }];
}

export function bounceSpikeCandidates(db: Db, ctx: ConditionContext): AlertCandidate[] {
  const since = new Date(ctx.now.getTime() - BOUNCE_WINDOW_MS);
  const rows = db.select({ id: sendEvents.id })
    .from(sendEvents)
    .where(and(eq(sendEvents.type, 'bounced'), gte(sendEvents.receivedAt, since)))
    .all();
  if (rows.length < BOUNCE_SPIKE_MIN) return [];
  const day = dayBucket(ctx.now, ctx.timezone);
  return [{
    kind: 'bounce_spike',
    key: `bounces:${day}`,
    title: `${rows.length} bounces in the last 24 hours`,
    detail: String(rows.length),
    href: null,
  }];
}

export function complaintCandidates(db: Db, ctx: ConditionContext): AlertCandidate[] {
  const since = lookbackStart(ctx.now);
  const rows = db.select({ id: sendEvents.id })
    .from(sendEvents)
    .where(and(eq(sendEvents.type, 'complained'), gte(sendEvents.receivedAt, since)))
    .all();
  return rows.map(row => ({
    kind: 'complaint' as const,
    key: `complaint:${row.id}`,
    title: 'Spam complaint received',
    detail: null,
    href: null,
  }));
}

/** Scheduler-error candidate is built by the scheduler listener, not a DB sweep, but shares the shape. */
export function schedulerErrorCandidate(name: string, err: unknown, ctx: ConditionContext): AlertCandidate {
  const day = dayBucket(ctx.now, ctx.timezone);
  const message = err instanceof Error ? err.message : String(err);
  return {
    kind: 'scheduler_error',
    key: `scheduler:${name}:${day}`,
    title: `Scheduled job "${name}" threw`,
    detail: message,
    href: null,
  };
}

export function allSweepCandidates(db: Db, ctx: ConditionContext): AlertCandidate[] {
  return [
    ...digestFailedCandidates(db, ctx),
    ...announcementFailedCandidates(db, ctx),
    ...rejectionSpikeCandidates(db, ctx),
    ...bounceSpikeCandidates(db, ctx),
    ...complaintCandidates(db, ctx),
  ];
}
