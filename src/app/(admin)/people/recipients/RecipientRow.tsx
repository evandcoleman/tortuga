'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, TD, TR } from '../../_components/ui';
import { removeRecipient, type ActionResult } from './actions';

export interface RecipientRowData {
  email: string;
  name: string;
  plexUsername: string | null;
  source: 'plex' | 'manual';
  active: boolean;
  welcomedAt: string | null;
}

const initial: ActionResult = { status: 'idle' };

export function RecipientRow({ recipient }: { recipient: RecipientRowData }) {
  const [state, action, pending] = useActionState(removeRecipient, initial);
  const error = state.status === 'error' ? state.error : null;
  const router = useRouter();
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [isSendingWelcome, startSendingWelcome] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(`Remove ${recipient.email}? They will stop receiving the newsletter.`)) {
      e.preventDefault();
    }
  };

  const onSendWelcome = () => {
    setWelcomeError(null);
    startSendingWelcome(async () => {
      const res = await fetch(`/api/recipients/${encodeURIComponent(recipient.email)}/welcome`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWelcomeError(data.error ?? 'Failed to send welcome email');
        return;
      }
      router.refresh();
    });
  };

  return (
    <TR>
      <TD>
        <span className="font-mono text-[12.5px] text-fg">{recipient.email}</span>
      </TD>
      <TD className="text-muted">{recipient.name}</TD>
      <TD>
        {recipient.plexUsername ? (
          <span className="font-mono text-[12px] text-muted">{recipient.plexUsername}</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </TD>
      <TD>
        {recipient.source === 'manual' ? (
          <Badge tone="info">Manual</Badge>
        ) : (
          <Badge tone="neutral">Plex</Badge>
        )}
      </TD>
      <TD>
        <div className="flex flex-wrap items-center gap-1.5">
          {recipient.active ? (
            <Badge tone="success" dot>
              active
            </Badge>
          ) : (
            <Badge tone="neutral">unsubscribed</Badge>
          )}
          {!recipient.welcomedAt ? <Badge tone="warning">not welcomed</Badge> : null}
        </div>
      </TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          {!recipient.welcomedAt && recipient.active ? (
            <Button type="button" onClick={onSendWelcome} disabled={isSendingWelcome} aria-busy={isSendingWelcome}>
              {isSendingWelcome ? 'Sending…' : 'Send welcome'}
            </Button>
          ) : null}
          {recipient.active ? (
            <form action={action} onSubmit={onSubmit} className="inline">
              <input type="hidden" name="email" value={recipient.email} />
              <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
                {pending ? 'Removing…' : 'Remove'}
              </Button>
            </form>
          ) : (
            <span className="text-[12px] text-faint">—</span>
          )}
        </div>
        {error ? (
          <div className="mt-1 text-[11.5px] text-danger" role="alert">
            {error}
          </div>
        ) : null}
        {welcomeError ? (
          <div className="mt-1 text-[11.5px] text-danger" role="alert">
            {welcomeError}
          </div>
        ) : null}
      </TD>
    </TR>
  );
}
