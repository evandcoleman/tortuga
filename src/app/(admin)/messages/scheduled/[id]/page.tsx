import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { auth } from '@/kernel/auth/auth';
import { getAppContext } from '@/kernel/context';
import { announcements } from '@/modules/announcements/schema';
import { recipientsCache } from '@/modules/newsletter/schema';
import { listTemplates } from '@/modules/templates/service';
import { utcToWallClock } from '@/kernel/time/zoned';
import { Card, EmptyState, PageHeader } from '../../../_components/ui';
import { MessageComposer } from '../../MessageComposer';

export const dynamic = 'force-dynamic';

async function resolveAdminEmail(ctx: ReturnType<typeof getAppContext>): Promise<string> {
  const mode = (process.env.AUTH_MODE ?? 'session') as 'session' | 'forward';
  if (mode === 'session') {
    const session = await auth();
    if (session?.user?.email) return session.user.email;
  }
  return ctx.env.ADMIN_EMAIL ?? '';
}

export default async function EditScheduledMessage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = getAppContext();
  const [row] = ctx.db.select().from(announcements).where(eq(announcements.id, id)).all();

  if (!row || row.status !== 'scheduled') {
    return (
      <div>
        <PageHeader eyebrow="Newsletter" title="Edit scheduled message" />
        <Card>
          <EmptyState
            title="This message is no longer scheduled"
            description="It may have already sent, been cancelled, or never existed."
            action={
              <Link href="/messages/history" className="text-[12.5px] font-medium text-gold hover:opacity-90">
                View history →
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const timezone = ctx.config.newsletter.timezone;
  const recipients = ctx.db
    .select()
    .from(recipientsCache)
    .all()
    .filter(r => r.active)
    .map(r => ({ email: r.email, name: r.name }))
    .sort((a, b) => a.email.localeCompare(b.email));
  const adminEmail = await resolveAdminEmail(ctx);
  const templates = listTemplates(ctx.db).map(t => ({
    slug: t.slug,
    name: t.name,
    subject: t.subject,
    body: t.body,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Edit scheduled message"
        description="Update the subject, body, recipients, or send time. Cancel below to stop the send entirely."
        actions={
          <Link href="/messages" className="text-[12.5px] font-medium text-gold hover:opacity-90">
            ← Back to messages
          </Link>
        }
      />
      <MessageComposer
        recipients={recipients}
        defaultTestEmail={adminEmail}
        timezone={timezone}
        templates={templates}
        initial={{
          subject: row.subject,
          body: row.body,
          recipientEmails: JSON.parse(row.recipientEmails) as string[],
        }}
        editing={{
          id: row.id,
          // row.scheduledAt is always set on scheduled rows.
          wallClock: utcToWallClock(row.scheduledAt as Date, timezone),
        }}
      />
    </div>
  );
}
