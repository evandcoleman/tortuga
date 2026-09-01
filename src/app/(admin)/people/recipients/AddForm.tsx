'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button, Card, CardHeader } from '../../_components/ui';
import { addRecipient, type ActionResult } from './actions';

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

const initial: ActionResult = { status: 'idle' };

export function AddForm() {
  const [state, action, pending] = useActionState(addRecipient, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful add so the next entry starts fresh.
  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader
        title="Add recipient"
        description="Manually-added recipients are kept on every Plex sync."
      />
      <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
            Email
          </span>
          <input
            className={inputCls}
            name="email"
            type="email"
            required
            placeholder="someone@example.com"
            aria-invalid={state.status === 'error'}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
            Name <span className="normal-case text-faint">(optional)</span>
          </span>
          <input className={inputCls} name="name" type="text" placeholder="Jane Doe" />
        </label>
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {state.status === 'error' ? (
        <p className="mt-2 text-[12px] text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-2 text-[12px] text-success" role="status">
          {state.message}
        </p>
      ) : null}
    </Card>
  );
}
