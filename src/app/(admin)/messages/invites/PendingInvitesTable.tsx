'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, TD, TH, THead, TR, Table, formatDateTime } from '../../_components/ui';
import type { InviteFormSection } from './InviteForm';

export interface PendingInviteRow {
  email: string;
  sectionIds: string[];
  sentAt: string | null;
  welcomeSentAt: string | null;
}

export interface PendingInvitesTableProps {
  rows: PendingInviteRow[];
  sections: InviteFormSection[];
}

export function PendingInvitesTable({ rows, sections }: PendingInvitesTableProps) {
  const titleById = new Map(sections.map(s => [s.id, s.title]));

  return (
    <Table>
      <THead>
        <tr>
          <TH>Email</TH>
          <TH>Libraries</TH>
          <TH>Sent</TH>
          <TH>Welcome</TH>
          <TH className="text-right">Actions</TH>
        </tr>
      </THead>
      <tbody>
        {rows.map(row => (
          <InviteRow key={row.email} row={row} titleById={titleById} />
        ))}
      </tbody>
    </Table>
  );
}

function InviteRow({ row, titleById }: { row: PendingInviteRow; titleById: Map<string, string> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, startCancelling] = useTransition();
  const [isResending, startResending] = useTransition();

  const onCancel = () => {
    if (!window.confirm(`Cancel the invite for ${row.email}?`)) return;
    setError(null);
    startCancelling(async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(row.email)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to cancel');
        return;
      }
      router.refresh();
    });
  };

  const onResend = () => {
    setError(null);
    startResending(async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(row.email)}/resend`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to resend');
        return;
      }
      router.refresh();
    });
  };

  return (
    <TR>
      <TD>
        <span className="font-mono text-[12.5px] text-fg">{row.email}</span>
      </TD>
      <TD className="text-[12.5px] text-muted">
        {row.sectionIds.map(id => titleById.get(id) ?? id).join(', ') || '—'}
      </TD>
      <TD className="text-[12.5px] text-muted">{row.sentAt ? formatDateTime(new Date(row.sentAt)) : '—'}</TD>
      <TD>
        {row.welcomeSentAt ? (
          <Badge tone="success" dot>sent</Badge>
        ) : (
          <Badge tone="warning">not sent</Badge>
        )}
      </TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={onResend} disabled={isResending} aria-busy={isResending}>
            {isResending ? 'Resending…' : 'Resend welcome'}
          </Button>
          <Button type="button" variant="danger" onClick={onCancel} disabled={isCancelling} aria-busy={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        </div>
        {error ? (
          <div className="mt-1 text-[11.5px] text-danger" role="alert">
            {error}
          </div>
        ) : null}
      </TD>
    </TR>
  );
}
