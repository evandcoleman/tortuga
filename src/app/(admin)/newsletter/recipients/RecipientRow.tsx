'use client';

import { useActionState } from 'react';
import { Badge, Button, TD, TR } from '../../_components/ui';
import { removeRecipient, type ActionResult } from './actions';

export interface RecipientRowData {
  email: string;
  name: string;
  plexUsername: string | null;
  source: 'plex' | 'manual';
  active: boolean;
}

const initial: ActionResult = { status: 'idle' };

export function RecipientRow({ recipient }: { recipient: RecipientRowData }) {
  const [state, action, pending] = useActionState(removeRecipient, initial);
  const error = state.status === 'error' ? state.error : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(`Remove ${recipient.email}? They will stop receiving the newsletter.`)) {
      e.preventDefault();
    }
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
        {recipient.active ? (
          <Badge tone="success" dot>
            active
          </Badge>
        ) : (
          <Badge tone="neutral">unsubscribed</Badge>
        )}
      </TD>
      <TD className="text-right">
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
        {error ? (
          <span className="ml-2 text-[11.5px] text-danger" role="alert">
            {error}
          </span>
        ) : null}
      </TD>
    </TR>
  );
}
