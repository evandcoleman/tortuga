import Link from 'next/link';
import { auth } from '@/kernel/auth/auth';
import { getAppContext } from '@/kernel/context';
import { recipientsCache } from '@/modules/newsletter/schema';
import { PageHeader } from '../_components/ui';
import { MessageComposer } from './MessageComposer';

export const dynamic = 'force-dynamic';

async function resolveAdminEmail(ctx: ReturnType<typeof getAppContext>): Promise<string> {
  const mode = (process.env.AUTH_MODE ?? 'session') as 'session' | 'forward';
  if (mode === 'session') {
    const session = await auth();
    if (session?.user?.email) return session.user.email;
  }
  return ctx.env.ADMIN_EMAIL ?? '';
}

export default async function Messages() {
  const ctx = getAppContext();
  const recipients = ctx.db
    .select()
    .from(recipientsCache)
    .all()
    .filter(r => r.active)
    .map(r => ({ email: r.email, name: r.name }))
    .sort((a, b) => a.email.localeCompare(b.email));
  const adminEmail = await resolveAdminEmail(ctx);

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Compose a message"
        description="Send a one-off email to all or a chosen subset of active recipients, using the same themed shell as the weekly digest."
        actions={
          <Link
            href="/messages/history"
            className="text-[12.5px] font-medium text-gold hover:opacity-90"
          >
            View history →
          </Link>
        }
      />
      <MessageComposer recipients={recipients} defaultTestEmail={adminEmail} />
    </div>
  );
}
