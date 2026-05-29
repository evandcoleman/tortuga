'use client';

import { Badge } from '../_components/ui';
import type {
  ConnectionTestResult,
  ConnectionTestsResult,
} from '@/kernel/integrations/connection-tests';

interface ServiceRow {
  key: keyof ConnectionTestsResult;
  label: string;
}

const SERVICES: ReadonlyArray<ServiceRow> = [
  { key: 'tautulli', label: 'Tautulli' },
  { key: 'tmdb', label: 'TMDB' },
  { key: 'email', label: 'Email provider' },
];

function StatusBadge({ result, pending }: { result?: ConnectionTestResult; pending: boolean }) {
  if (pending) return <Badge tone="neutral">Testing…</Badge>;
  if (!result) return <Badge tone="neutral">Not tested</Badge>;
  return result.ok ? (
    <Badge tone="success" dot>
      OK
    </Badge>
  ) : (
    <Badge tone="danger" dot>
      Failed
    </Badge>
  );
}

export function ConnectionStatus({
  results,
  pending,
}: {
  results: ConnectionTestsResult | null;
  pending: boolean;
}) {
  return (
    <ul className="grid gap-2">
      {SERVICES.map(({ key, label }) => {
        const result = results?.[key];
        return (
          <li
            key={key}
            className="flex items-start justify-between gap-4 rounded-md border border-line bg-canvas/40 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-fg">{label}</div>
              {!pending && result ? (
                <p
                  className={`mt-0.5 text-[12px] leading-relaxed ${result.ok ? 'text-muted' : 'text-danger'}`}
                >
                  {result.message}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 pt-0.5">
              <StatusBadge result={result} pending={pending} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
