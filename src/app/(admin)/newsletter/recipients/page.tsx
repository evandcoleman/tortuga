import { getAppContext } from '@/kernel/context';
import { recipientsCache } from '@/modules/newsletter/schema';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Stat,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatRelative,
} from '../../_components/ui';

export const dynamic = 'force-dynamic';

export default function Recipients() {
  const ctx = getAppContext();
  const rows = ctx.db.select().from(recipientsCache).all();
  const active = rows.filter(r => r.active);
  const inactive = rows.filter(r => !r.active);
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
        description="Synced from Plex. Anyone who unsubscribes via the digest is marked inactive automatically."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Active" value={active.length} tone="success" />
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

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No recipients cached"
            description="Tortuga refreshes recipients on each run. Trigger a preview to populate this list from Plex."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Email</TH>
              <TH>Name</TH>
              <TH>Plex</TH>
              <TH className="text-right">Status</TH>
            </tr>
          </THead>
          <tbody>
            {sorted.map(r => (
              <TR key={r.email}>
                <TD>
                  <span className="font-mono text-[12.5px] text-fg">{r.email}</span>
                </TD>
                <TD className="text-muted">{r.name}</TD>
                <TD>
                  {r.plexUsername ? (
                    <span className="font-mono text-[12px] text-muted">{r.plexUsername}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </TD>
                <TD className="text-right">
                  {r.active ? (
                    <Badge tone="success" dot>
                      active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">unsubscribed</Badge>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
