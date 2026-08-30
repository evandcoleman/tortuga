import Link from 'next/link';
import { desc, isNotNull } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests, sends, recipientsCache } from '@/modules/newsletter/schema';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DigestStatusBadge,
  EmptyState,
  PageHeader,
  Stat,
  formatDateTime,
  formatRelative,
} from './_components/ui';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

export default function Dashboard() {
  const ctx = getAppContext();

  const missingServices: Array<{ label: string; href: string }> = [
    ...(!ctx.tautulli ? [{ label: 'Tautulli', href: '/settings/services' }] : []),
    ...(!ctx.tmdb ? [{ label: 'TMDB', href: '/settings/services' }] : []),
    ...(!ctx.email ? [{ label: 'Email provider', href: '/settings/email' }] : []),
  ];

  const recent = ctx.db
    .select()
    .from(digests)
    .orderBy(desc(digests.scheduledAt))
    .limit(5)
    .all();
  const lastDigest = recent[0];
  // Digest-only stats: exclude one-off announcement sends (digestId null).
  const allSends = ctx.db.select().from(sends).where(isNotNull(sends.digestId)).all();
  const recipients = ctx.db.select().from(recipientsCache).all();
  const totalDigests = ctx.db.select().from(digests).all().length;

  const activeRecipients = recipients.filter(r => r.active).length;
  const totalSends = allSends.length;
  const since30 = Date.now() - 30 * DAY;
  const sends30 = allSends.filter(s => (s.sentAt?.getTime() ?? 0) >= since30).length;
  const failures30 = allSends.filter(
    s => (s.sentAt?.getTime() ?? 0) >= since30 && s.status === 'failed',
  ).length;
  const deliveryRate = sends30 > 0 ? Math.round(((sends30 - failures30) / sends30) * 100) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Welcome aboard."
        description="Send-side snapshot for your Plex digest. The pipeline pulls from Tautulli, enriches via TMDB, and ships through your configured email provider."
        actions={
          <>
            <Link href="/newsletter/preview">
              <Button variant="primary">Open preview</Button>
            </Link>
            <Link href="/newsletter/history">
              <Button variant="secondary">View history</Button>
            </Link>
          </>
        }
      />

      {missingServices.length > 0 ? (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning/8 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-medium text-fg">Finish setup to unlock the full pipeline</div>
              <p className="mt-1 text-[12.5px] text-muted">
                Not configured yet: {missingServices.map(s => s.label).join(', ')}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...new Map(missingServices.map(s => [s.href, s])).values()].map(s => (
                <Link key={s.href} href={s.href}>
                  <Button variant="secondary">Configure {s.label === 'Email provider' ? 'email' : 'services'} →</Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Last digest"
          value={lastDigest ? <DigestStatusBadge status={lastDigest.status} /> : '—'}
          hint={
            lastDigest
              ? `${formatRelative(lastDigest.scheduledAt)} · ${lastDigest.itemCount} items`
              : 'No digests scheduled yet'
          }
        />
        <Stat
          label="Active recipients"
          value={activeRecipients}
          hint={`${recipients.length - activeRecipients} unsubscribed`}
        />
        <Stat
          label="Sends (30d)"
          value={sends30}
          hint={failures30 > 0 ? `${failures30} failed` : 'No failures'}
          tone={failures30 > 0 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Delivery rate"
          value={deliveryRate === null ? '—' : `${deliveryRate}%`}
          hint={deliveryRate === null ? 'Awaiting first send' : 'last 30 days'}
          tone={
            deliveryRate === null
              ? 'neutral'
              : deliveryRate >= 98
                ? 'success'
                : deliveryRate >= 90
                  ? 'warning'
                  : 'danger'
          }
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent digests"
            description="The last five runs, newest first."
            action={
              <Link href="/newsletter/history" className="text-[12.5px] text-muted hover:text-fg">
                See all →
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              title="No digests yet"
              description="Generate a preview to see what this week's digest will look like before it ships."
              action={
                <Link href="/newsletter/preview">
                  <Button variant="primary">Generate preview</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map(d => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <DigestStatusBadge status={d.status} />
                      <span className="text-[13px] text-fg">{d.itemCount} items</span>
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {formatDateTime(d.scheduledAt)} ·{' '}
                      <span className="text-subtle">{formatRelative(d.scheduledAt)}</span>
                    </div>
                  </div>
                  {d.error ? (
                    <Badge tone="danger" className="max-w-[260px] truncate" title={d.error}>
                      {d.error}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Pipeline" description="What runs under the hood." />
          <ol className="space-y-3">
            <Step n={1} title="Tautulli" subtitle="Pulls new library additions." />
            <Step n={2} title="TMDB" subtitle="Enriches with posters, synopsis, ratings." />
            <Step n={3} title="Filter" subtitle="Applies allow/blocklists from config." />
            <Step n={4} title="Render" subtitle="Builds the HTML email." />
            <Step n={5} title="Send" subtitle={ctx.email ? `via ${ctx.email.name}.` : "No provider configured."} />
          </ol>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader title="Lifetime" description="All-time totals across the install." />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Mini label="Digests" value={totalDigests} />
            <Mini label="Sends" value={totalSends} />
            <Mini label="Recipients" value={recipients.length} />
            <Mini label="Provider" value={ctx.email?.name ?? "Not set"} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function Step({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-medium text-muted ring-1 ring-line">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        <div className="text-[12px] text-muted">{subtitle}</div>
      </div>
    </li>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-1 font-display text-[20px] font-semibold tracking-[-0.01em] text-fg">{value}</div>
    </div>
  );
}
