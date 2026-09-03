import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { alerts } from '@/modules/alerts/schema';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDateTime,
  formatRelative,
} from '../_components/ui';
import { AcknowledgeButton } from './AcknowledgeButton';

export const dynamic = 'force-dynamic';

const MAX_ALERTS = 100;

export default function AlertsHistory() {
  const ctx = getAppContext();
  const rows = ctx.db
    .select()
    .from(alerts)
    .orderBy(desc(alerts.createdAt))
    .limit(MAX_ALERTS)
    .all();

  const hasOpen = rows.some(a => !a.acknowledgedAt);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Alerts"
        description="The 100 most recent alerts, newest first."
        actions={hasOpen ? <AcknowledgeButton id="all" /> : undefined}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No alerts"
            description="Scheduler failures, provider rejections, and bounce or complaint spikes will show up here."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Status</TH>
              <TH>Kind</TH>
              <TH className="w-[36%]">Alert</TH>
              <TH>Created</TH>
              <TH>Acknowledged</TH>
              <TH />
            </tr>
          </THead>
          <tbody>
            {rows.map(a => (
              <TR key={a.id}>
                <TD>
                  <Badge tone={a.acknowledgedAt ? 'neutral' : 'danger'} dot>
                    {a.acknowledgedAt ? 'Acknowledged' : 'Open'}
                  </Badge>
                </TD>
                <TD>
                  <span className="font-mono text-[12px] text-muted">{a.kind}</span>
                </TD>
                <TD>
                  <div className="text-[13.5px] font-medium text-fg">{a.title}</div>
                  {a.detail ? (
                    <div className="mt-0.5 truncate text-[12.5px] text-muted" title={a.detail}>
                      {a.detail}
                    </div>
                  ) : null}
                </TD>
                <TD>
                  <span title={formatDateTime(a.createdAt)} className="text-[12.5px] text-muted">
                    {formatRelative(a.createdAt)}
                  </span>
                </TD>
                <TD>
                  {a.acknowledgedAt ? (
                    <span title={formatDateTime(a.acknowledgedAt)} className="text-[12.5px] text-muted">
                      {formatRelative(a.acknowledgedAt)}
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    {a.href ? (
                      <Link href={a.href} className="text-[12.5px] font-medium text-gold hover:opacity-90">
                        Open
                      </Link>
                    ) : null}
                    {a.acknowledgedAt ? null : <AcknowledgeButton id={a.id} />}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
