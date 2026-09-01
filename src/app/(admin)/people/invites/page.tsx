import { getAppContext } from '@/kernel/context';
import { listInvites, parseSectionIds } from '@/modules/invites/service';
import { Card, CardHeader, PageHeader, EmptyState } from '../../_components/ui';
import { InviteForm } from './InviteForm';
import { PendingInvitesTable, type PendingInviteRow } from './PendingInvitesTable';

export const dynamic = 'force-dynamic';

export default async function InvitesPage() {
  const ctx = getAppContext();

  if (!ctx.plex) {
    return (
      <div>
        <PageHeader
          eyebrow="People"
          title="Invites"
          description="Send Plex invites and the welcome email in one step."
        />
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
      <PageHeader
        eyebrow="People"
        title="Invites"
        description="Send Plex invites and the welcome email in one step."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <InviteForm sections={sections} sectionsUnavailable={!sectionsResult.ok} />
        <Card>
          <CardHeader
            title="How it works"
            description="Tortuga sends the Plex invite, then immediately emails the welcome guide to the same address. Users invited outside Tortuga show up as “not welcomed” on the Recipients page instead — send their welcome from there."
          />
        </Card>
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
