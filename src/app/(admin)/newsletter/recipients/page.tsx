import { getAppContext } from '@/kernel/context';
import { recipientsCache } from '@/modules/newsletter/schema';
import {
  Card,
  EmptyState,
  PageHeader,
  Stat,
  TH,
  THead,
  Table,
  formatRelative,
} from '../../_components/ui';
import { AddForm } from './AddForm';
import { ImportForm } from './ImportForm';
import { RecipientRow, type RecipientRowData } from './RecipientRow';

export const dynamic = 'force-dynamic';

export default function Recipients() {
  const ctx = getAppContext();
  const rows = ctx.db.select().from(recipientsCache).all();
  const active = rows.filter(r => r.active);
  const inactive = rows.filter(r => !r.active);
  const manual = rows.filter(r => r.source === 'manual');
  const notWelcomed = rows.filter(r => r.active && !r.welcomedAt);
  const sorted = [...rows].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
  const lastSync = rows.length > 0 ? Math.max(...rows.map(r => r.lastSynced.getTime())) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Recipients"
        description="Synced from Plex and managed by hand. Manual recipients survive every Plex sync; unsubscribes are marked inactive automatically."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
        <Stat label="Active" value={active.length} tone="success" />
        <Stat label="Manual" value={manual.length} tone={manual.length > 0 ? 'info' : 'neutral'} />
        <Stat
          label="Not welcomed"
          value={notWelcomed.length}
          tone={notWelcomed.length > 0 ? 'warning' : 'neutral'}
          hint="Invited outside Tortuga, or invited but the welcome email hasn't sent"
        />
        <Stat
          label="Unsubscribed"
          value={inactive.length}
          tone={inactive.length > 0 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Last sync"
          value={lastSync ? formatRelative(lastSync) : '—'}
          hint={rows.length > 0 ? `${rows.length} total cached` : 'No recipients yet'}
        />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <AddForm />
        <ImportForm />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No recipients yet"
            description="Add someone above, import a list, or trigger a preview to populate this from Plex."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Email</TH>
              <TH>Name</TH>
              <TH>Plex</TH>
              <TH>Source</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {sorted.map(r => {
              const data: RecipientRowData = {
                email: r.email,
                name: r.name,
                plexUsername: r.plexUsername,
                source: r.source,
                active: r.active,
                welcomedAt: r.welcomedAt ? r.welcomedAt.toISOString() : null,
              };
              return <RecipientRow key={r.email} recipient={data} />;
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
