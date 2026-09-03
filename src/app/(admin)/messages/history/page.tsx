import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { announcements } from '@/modules/announcements/schema';
import { sends } from '@/modules/newsletter/schema';
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
} from '../../_components/ui';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'neutral',
  cancelled: 'neutral',
  sending: 'warning',
  sent: 'success',
  partial: 'warning',
  failed: 'danger',
};

export default function MessagesHistory() {
  const ctx = getAppContext();
  const rows = ctx.db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt))
    .limit(50)
    .all();

  const counts: Record<string, Record<string, number>> = {};
  for (const s of ctx.db
    .select({ announcementId: sends.announcementId, status: sends.status })
    .from(sends)
    .all()) {
    if (!s.announcementId) continue; // digest sends have no announcementId
    counts[s.announcementId] = counts[s.announcementId] ?? {};
    counts[s.announcementId][s.status] = (counts[s.announcementId][s.status] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Messages"
        title="Message history"
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No messages sent yet"
            description="Compose and send a message to see delivery results here."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-[32%]">Subject</TH>
              <TH>Sent at</TH>
              <TH>Status</TH>
              <TH className="text-right">Sent</TH>
              <TH className="text-right">Failed</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map(a => {
              const sent = counts[a.id]?.sent ?? 0;
              const delivered = counts[a.id]?.delivered ?? 0;
              const failed = (counts[a.id]?.failed ?? 0) + (counts[a.id]?.bounced ?? 0) + (counts[a.id]?.complained ?? 0);
              return (
                <TR key={a.id}>
                  <TD>
                    <Link
                      href={`/messages/history/${a.id}`}
                      className="font-medium text-fg hover:text-gold"
                    >
                      {a.subject}
                    </Link>
                  </TD>
                  <TD>
                    {a.status === 'cancelled' ? (
                      <span className="text-faint">—</span>
                    ) : a.status === 'scheduled' && a.scheduledAt ? (
                      <div className="text-[13px] text-fg">{formatDateTime(a.scheduledAt)}</div>
                    ) : a.sentAt ? (
                      <>
                        <div className="text-[13px] text-fg">{formatDateTime(a.sentAt)}</div>
                        <div className="text-[11.5px] text-subtle">{formatRelative(a.sentAt)}</div>
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[a.status] ?? 'neutral'} dot>
                      {a.status}
                    </Badge>
                  </TD>
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
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
