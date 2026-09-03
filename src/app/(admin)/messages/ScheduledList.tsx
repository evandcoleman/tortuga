'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card, CardHeader } from '../_components/ui';
import { cancelScheduledAnnouncement } from './actions';

export interface ScheduledRow {
  id: string;
  subject: string;
  wallClock: string;
  recipientCount: number;
}

interface ScheduledListProps {
  rows: ScheduledRow[];
  timezone: string;
}

/** Pending "Scheduled" messages, shown above the composer. Hidden when empty. */
export function ScheduledList({ rows, timezone }: ScheduledListProps) {
  if (rows.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader title="Scheduled" />
      <ul className="flex flex-col divide-y divide-line">
        {rows.map(row => (
          <ScheduledRowItem key={row.id} row={row} timezone={timezone} />
        ))}
      </ul>
    </Card>
  );
}

function ScheduledRowItem({ row, timezone }: { row: ScheduledRow; timezone: string }) {
  const router = useRouter();
  const [isCancelling, startCancelling] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onCancel = () => {
    if (!window.confirm(`Cancel "${row.subject}"?`)) return;
    setError(null);
    startCancelling(async () => {
      const result = await cancelScheduledAnnouncement(row.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-[13.5px] font-medium text-fg">{row.subject}</div>
        <div className="text-[12px] text-muted">
          Sends {row.wallClock} ({timezone}) · {row.recipientCount} recipient{row.recipientCount === 1 ? '' : 's'}
        </div>
        {error ? <div className="mt-1 text-[12px] text-danger">{error}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[12px] font-medium">
        <Link href={`/messages/scheduled/${row.id}`} className="text-gold hover:opacity-90">
          Edit
        </Link>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="text-muted hover:text-danger disabled:opacity-50"
        >
          {isCancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
    </li>
  );
}
