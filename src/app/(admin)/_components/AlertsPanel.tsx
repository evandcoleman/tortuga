import Link from 'next/link';
import { desc, isNull } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { alerts } from '@/modules/alerts/schema';
import { AcknowledgeButton } from '../alerts/AcknowledgeButton';
import { Card, CardHeader, formatDateTime, formatRelative } from './ui';

const MAX_ALERTS = 20;

/** Danger-toned "Needs attention" panel. Renders nothing when there are no open alerts. */
export function AlertsPanel() {
  const ctx = getAppContext();
  const rows = ctx.db
    .select()
    .from(alerts)
    .where(isNull(alerts.acknowledgedAt))
    .orderBy(desc(alerts.createdAt))
    .limit(MAX_ALERTS)
    .all();

  if (rows.length === 0) return null;

  return (
    <Card className="mb-8 border-danger/30 bg-danger/5">
      <CardHeader
        title="Needs attention"
        description={`${rows.length} unacknowledged alert${rows.length === 1 ? '' : 's'}.`}
        action={
          <div className="flex items-center gap-4">
            <AcknowledgeButton id="all" />
            <Link href="/alerts" className="text-[12.5px] text-muted hover:text-fg">
              View all →
            </Link>
          </div>
        }
      />
      <ul className="divide-y divide-line">
        {rows.map(a => (
          <li key={a.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-fg">{a.title}</div>
              {a.detail ? (
                <div className="mt-0.5 truncate text-[12.5px] text-muted" title={a.detail}>
                  {a.detail}
                </div>
              ) : null}
              <div className="mt-1 text-[11.5px] text-subtle" title={formatDateTime(a.createdAt)}>
                {formatRelative(a.createdAt)}
                {a.href ? (
                  <>
                    {' · '}
                    <Link href={a.href} className="text-gold hover:opacity-90">
                      Open
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
            <AcknowledgeButton id={a.id} className="shrink-0" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
