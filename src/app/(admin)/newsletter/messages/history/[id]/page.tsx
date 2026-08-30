import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { announcements } from '@/modules/announcements/schema';
import { sends } from '@/modules/newsletter/schema';
import {
  Badge,
  Card,
  PageHeader,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDateTime,
} from '../../../../_components/ui';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  sending: 'warning',
  sent: 'success',
  partial: 'warning',
  failed: 'danger',
};

const SEND_STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  queued: 'neutral',
  sent: 'success',
  delivered: 'success',
  bounced: 'danger',
  complained: 'danger',
  failed: 'danger',
};

export default async function MessageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = getAppContext();
  const rows = ctx.db.select().from(announcements).where(eq(announcements.id, id)).all();
  const announcement = rows[0];
  if (!announcement) notFound();

  const sendRows = ctx.db.select().from(sends).where(eq(sends.announcementId, id)).all();

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title={announcement.subject}
        description="Per-recipient delivery status for this message."
        actions={
          <Link
            href="/newsletter/messages/history"
            className="text-[12.5px] font-medium text-gold hover:opacity-90"
          >
            ← All messages
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Status</div>
          <div className="mt-2">
            <Badge tone={STATUS_TONE[announcement.status] ?? 'neutral'} dot>
              {announcement.status}
            </Badge>
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Sent at</div>
          <div className="mt-2 text-[14px] text-fg">
            {announcement.sentAt ? formatDateTime(announcement.sentAt) : '—'}
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Recipients</div>
          <div className="mt-2 font-display text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg">
            {sendRows.length}
          </div>
        </Card>
      </div>

      {announcement.error ? (
        <Card className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Error</div>
          <div className="mt-2 font-mono text-[12.5px] text-danger">{announcement.error}</div>
        </Card>
      ) : null}

      <Table>
        <THead>
          <tr>
            <TH>Recipient</TH>
            <TH>Status</TH>
            <TH>Sent at</TH>
            <TH>Error</TH>
          </tr>
        </THead>
        <tbody>
          {sendRows.map(s => (
            <TR key={s.id}>
              <TD>
                <div className="text-[13px] text-fg">{s.recipientName}</div>
                <div className="text-[11.5px] text-subtle">{s.recipientEmail}</div>
              </TD>
              <TD>
                <Badge tone={SEND_STATUS_TONE[s.status] ?? 'neutral'} dot>
                  {s.status}
                </Badge>
              </TD>
              <TD>{s.sentAt ? formatDateTime(s.sentAt) : <span className="text-faint">—</span>}</TD>
              <TD>
                {s.error ? (
                  <span className="block max-w-[280px] truncate font-mono text-[11.5px] text-danger" title={s.error}>
                    {s.error}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
