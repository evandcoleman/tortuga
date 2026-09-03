'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardHeader } from '../../_components/ui';
import { importRecipientsCsv, type ActionResult } from './actions';

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 font-mono text-[13px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

const initial: ActionResult = { status: 'idle' };

export function ImportForm() {
  const [text, setText] = useState('');
  // Wrap the server action so a successful import clears the textarea. Setting
  // state here runs inside the action's transition (not an effect), so it does
  // not trigger cascading renders.
  const [state, action, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const result = await importRecipientsCsv(_prev, formData);
      if (result.status === 'success') setText('');
      return result;
    },
    initial,
  );

  return (
    <Card>
      <CardHeader title="Add recipients" />
      <form action={action} className="grid gap-3">
        <textarea
          className={inputCls}
          name="csv"
          rows={5}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'a@example.com\nb@example.com, Bob\nc@example.com'}
        />
        <p className="text-[11.5px] text-muted">One per line: email, or email, Name</p>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending ? 'Adding…' : 'Add'}
          </Button>
          {state.status === 'error' ? (
            <span className="text-[12px] text-danger" role="alert">
              {state.error}
            </span>
          ) : null}
          {state.status === 'success' ? (
            <span className="text-[12px] text-success" role="status">
              {state.message}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
