import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests, sends } from '@/modules/newsletter/schema';
import {
  Badge,
  Card,
  DigestStatusBadge,
  EmptyState,
  PageHeader,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDateTime,
  formatRelative,
} from '../../_components/ui';

export const dynamic = 'force-dynamic';

export default function History() {
  const ctx = getAppContext();
  const rows = ctx.db
    .select()
    .from(digests)
    .orderBy(desc(digests.scheduledAt))
    .limit(50)
    .all();
  const counts: Record<string, Record<string, number>> = {};
  for (const s of ctx.db
    .select({ digestId: sends.digestId, status: sends.status })
    .from(sends)
    .all()) {
    if (!s.digestId) continue; // announcement sends have no digestId
    counts[s.digestId] = counts[s.digestId] ?? {};
    counts[s.digestId][s.status] = (counts[s.digestId][s.status] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="History"
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No history yet"
            description="Once digests run, you’ll see results here — status, item count, and delivery breakdown."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-[28%]">When</TH>
              <TH>Status</TH>
              <TH className="text-right">Items</TH>
              <TH className="text-right">Sent</TH>
              <TH className="text-right">Failed</TH>
              <TH>Error</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map(d => {
              const sent = counts[d.id]?.sent ?? 0;
              const delivered = counts[d.id]?.delivered ?? 0;
              const failed =
                (counts[d.id]?.failed ?? 0) +
                (counts[d.id]?.bounced ?? 0) +
                (counts[d.id]?.complained ?? 0);
              return (
                <TR key={d.id}>
                  <TD>
                    <div className="text-[13px] text-fg">{formatDateTime(d.scheduledAt)}</div>
                    <div className="text-[11.5px] text-subtle">{formatRelative(d.scheduledAt)}</div>
                  </TD>
                  <TD>
                    <DigestStatusBadge status={d.status} />
                  </TD>
                  <TD className="text-right font-mono text-[12.5px] text-muted">{d.itemCount}</TD>
                  <TD className="text-right">
                    <span className="font-mono text-[12.5px] text-fg">{sent + delivered}</span>
                  </TD>
                  <TD className="text-right">
                    {failed > 0 ? (
                      <Badge tone="danger">{failed}</Badge>
                    ) : (
                      <span className="font-mono text-[12.5px] text-faint">0</span>
                    )}
                  </TD>
                  <TD>
                    {d.error ? (
                      <span
                        className="block max-w-[280px] truncate font-mono text-[11.5px] text-danger"
                        title={d.error}
                      >
                        {d.error}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
