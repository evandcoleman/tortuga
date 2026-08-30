'use client';

import { useActionState } from 'react';
import type { ConnectionTestResult } from '@/kernel/integrations/connection-tests';
import { Button, Card, CardHeader } from '../../_components/ui';
import { TestButton } from './TestButton';

export type ServiceSaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const initial: ServiceSaveState = { status: 'idle' };

/** One card in /settings/services (and the email page's provider cards): its own Save + Test. */
export function ServiceCard({
  title,
  description,
  saveAction,
  testAction,
  children,
}: {
  title: string;
  description: string;
  saveAction: (prev: ServiceSaveState, fd: FormData) => Promise<ServiceSaveState>;
  testAction: () => Promise<ConnectionTestResult>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveAction, initial);

  return (
    <Card>
      <CardHeader title={title} description={description} action={<TestButton action={testAction} />} />
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        {children}
        <div className="col-span-full flex items-center gap-3 pt-1">
          <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
          {state.status === 'error' ? <span className="text-[13px] text-danger">{state.message}</span> : null}
        </div>
      </form>
    </Card>
  );
}
