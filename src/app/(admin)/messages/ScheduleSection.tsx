'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card, CardHeader } from '../_components/ui';
import {
  scheduleAnnouncementToRecipients,
  updateScheduledAnnouncement,
  cancelScheduledAnnouncement,
} from './actions';

export interface ScheduleEditingInfo {
  id: string;
  wallClock: string;
}

interface ScheduleSectionProps {
  subject: string;
  body: string;
  recipientEmails: string[];
  timezone: string;
  /** When set, the section behaves as an edit form for an existing scheduled row. */
  editing?: ScheduleEditingInfo;
}

/** Compose page's "Schedule" section: pick a wall-clock time and schedule/update/cancel a send. */
export function ScheduleSection({ subject, body, recipientEmails, timezone, editing }: ScheduleSectionProps) {
  const router = useRouter();
  const [wallClock, setWallClock] = useState(editing?.wallClock ?? '');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScheduling, startScheduling] = useTransition();
  const [isCancelling, startCancelling] = useTransition();

  const canSchedule = subject.trim().length > 0 && body.trim().length > 0
    && recipientEmails.length > 0 && wallClock.trim().length > 0 && !isScheduling;

  const onSchedule = () => {
    setError(null);
    startScheduling(async () => {
      try {
        if (editing) {
          const result = await updateScheduledAnnouncement(editing.id, subject.trim(), body, recipientEmails, wallClock);
          if (result.success) {
            setUpdated(true);
          } else {
            setError(result.error);
          }
        } else {
          const result = await scheduleAnnouncementToRecipients(subject.trim(), body, recipientEmails, wallClock);
          if (result.success) {
            setScheduledAt(result.scheduledAt);
          } else {
            setError(result.error);
          }
        }
      } catch {
        setError('Scheduling failed. Please try again.');
      }
    });
  };

  const onCancelSchedule = () => {
    if (!editing) return;
    if (!window.confirm('Cancel this scheduled send?')) return;
    setError(null);
    startCancelling(async () => {
      try {
        const result = await cancelScheduledAnnouncement(editing.id);
        if (result.success) {
          router.push('/messages');
        } else {
          setError(result.error);
        }
      } catch {
        setError('Cancel failed. Please try again.');
      }
    });
  };

  if (scheduledAt || updated) {
    return (
      <Card>
        <CardHeader title="Schedule" />
        <div className="rounded-md bg-elevated px-3 py-2.5 text-[12.5px] text-fg ring-1 ring-inset ring-line">
          <div>{scheduledAt ? `Scheduled for ${scheduledAt.toLocaleString()}` : 'Schedule updated'}</div>
          <Link href="/messages" className="mt-1 inline-block font-medium text-gold hover:opacity-90">
            View scheduled messages →
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Schedule"
        description={`Send this message later instead of now. Times use ${timezone}.`}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="schedule-time" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Send at ({timezone})
        </label>
        <input
          id="schedule-time"
          type="datetime-local"
          value={wallClock}
          onChange={e => setWallClock(e.target.value)}
          className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-[13.5px] text-fg focus:border-gold focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSchedule}
            disabled={!canSchedule}
            aria-busy={isScheduling}
            className="rounded-md bg-elevated px-3.5 py-2 text-[13px] font-medium text-fg ring-1 ring-inset ring-line transition hover:bg-surface hover:ring-line-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isScheduling ? 'Saving…' : editing ? 'Update schedule' : 'Schedule send'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={onCancelSchedule}
              disabled={isCancelling}
              aria-busy={isCancelling}
              className="rounded-md bg-danger/15 px-3.5 py-2 text-[13px] font-medium text-danger ring-1 ring-inset ring-danger/30 transition hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel schedule'}
            </button>
          ) : null}
        </div>
        {error ? <span className="text-[12px] font-medium text-red-600">{error}</span> : null}
      </div>
    </Card>
  );
}
