'use client';

import { useState, useTransition } from 'react';
import type { ConnectionTestResult } from '@/kernel/integrations/connection-tests';
import { Badge, Button } from '../../_components/ui';

/**
 * A "Test connection" button paired with an inline result. Deliberately
 * outside any `<form>`'s submit path — it never saves or invalidates
 * anything, it only pings the service with the currently effective config.
 */
export function TestButton({ label = 'Test', action }: { label?: string; action: () => Promise<ConnectionTestResult> }) {
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setFailed(false);
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult(null);
        setFailed(true);
      }
    });
  };

  return (
    <div className="flex items-center gap-2.5">
      <Button type="button" variant="secondary" onClick={run} disabled={pending} aria-busy={pending}>
        {pending ? 'Testing…' : label}
      </Button>
      {pending ? null : failed ? (
        <span className="text-[12px] text-danger">Could not run the test.</span>
      ) : result ? (
        <span className="flex items-center gap-2">
          <Badge tone={result.ok ? 'success' : 'danger'} dot>{result.ok ? 'OK' : 'Failed'}</Badge>
          <span className={`text-[12px] ${result.ok ? 'text-muted' : 'text-danger'}`}>{result.message}</span>
        </span>
      ) : null}
    </div>
  );
}
