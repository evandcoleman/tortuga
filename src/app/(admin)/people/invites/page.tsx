import { getAppContext } from '@/kernel/context';
import { listInvites, parseSectionIds } from '@/modules/invites/service';
import { Card, PageHeader, EmptyState } from '../../_components/ui';
import { InviteForm } from './InviteForm';
import { PendingInvitesTable, type PendingInviteRow } from './PendingInvitesTable';

export const dynamic = 'force-dynamic';

export default async function InvitesPage() {
  const ctx = getAppContext();

  if (!ctx.plex) {
    return (
      <div>
        <PageHeader eyebrow="People" title="Invites" />
        <Card>
          <EmptyState
            title="Plex isn't configured"
            description="Set the PLEX_TOKEN environment variable and newsletter.plex.server_id in tortuga.yml to enable invites. See docs/CONFIG.md."
          />
        </Card>
      </div>
    );
  }

  const dbInvites = listInvites(ctx.db);
  const [sectionsResult, pendingResult] = await Promise.all([
    ctx.plex.getSections(),
    ctx.plex.getPendingInvites(),
  ]);

  const sections = sectionsResult.ok ? sectionsResult.data.map(s => ({ id: s.id, title: s.title })) : [];
  const pendingFromPlex = pendingResult.ok ? pendingResult.data : [];

  const rows: PendingInviteRow[] = pendingFromPlex.map(p => {
    const local = dbInvites.find(i => i.email.toLowerCase() === p.invitedEmail.toLowerCase());
    return {
      email: p.invitedEmail,
      // plex.tv's pending-invites endpoint doesn't report library section ids; only
      // Tortuga's own invite record (when the invite went through Tortuga) has them.
      sectionIds: local ? parseSectionIds(local) : [],
      sentAt: local?.sentAt.toISOString() ?? null,
      welcomeSentAt: local?.welcomeSentAt?.toISOString() ?? null,
    };
  });

  return (
    <div>
      <PageHeader eyebrow="People" title="Invites" />

      <div className="mb-6">
        <InviteForm sections={sections} sectionsUnavailable={!sectionsResult.ok} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No pending invites"
            description="Invited users disappear from this list once they accept on plex.tv."
          />
        </Card>
      ) : (
        <PendingInvitesTable rows={rows} sections={sections} />
      )}
    </div>
  );
}
