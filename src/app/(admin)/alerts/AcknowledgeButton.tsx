'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { acknowledgeAlert, acknowledgeAllAlerts } from './actions';

interface AcknowledgeButtonProps {
  /** The alert id to acknowledge, or `'all'` to acknowledge every open alert. */
  id: string | 'all';
  className?: string;
}

/** Shared acknowledge control for the dashboard panel and the alerts history page. */
export function AcknowledgeButton({ id, className = '' }: AcknowledgeButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const result = id === 'all' ? await acknowledgeAllAlerts() : await acknowledgeAlert(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={`text-[12px] font-medium text-muted transition hover:text-fg disabled:opacity-50 ${className}`}
      >
        {isPending ? 'Acknowledging…' : id === 'all' ? 'Acknowledge all' : 'Acknowledge'}
      </button>
      {error ? <span className="text-[12px] text-danger">{error}</span> : null}
    </span>
  );
}
