import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import { getThemedPreviews } from '@/modules/newsletter/pipeline/preview-cache';
import { digests, recipientsCache } from '@/modules/newsletter/schema';
import { PreviewSwitcher } from './PreviewSwitcher';
import { SubmitButton } from './SubmitButton';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  formatDateTime,
  formatRelative,
} from '../../_components/ui';

export const dynamic = 'force-dynamic';

async function generate() {
  'use server';
  const ctx = getAppContext();
  await runDigest({
    db: ctx.db,
    tautulli: ctx.tautulli,
    tmdb: ctx.tmdb,
    provider: ctx.email,
    llm: ctx.llm,
    config: ctx.config.newsletter,
    appUrl: ctx.env.APP_URL,
    sessionSecret: ctx.env.SESSION_SECRET,
    scheduledAt: new Date(),
    dryRun: true,
    cacheThemedPreviews: true,
  });
  revalidatePath('/newsletter/preview');
}

export default function Preview() {
  const ctx = getAppContext();
  const latest = ctx.db
    .select()
    .from(digests)
    .where(eq(digests.status, 'rendered'))
    .orderBy(desc(digests.scheduledAt))
    .limit(1)
    .all();
  const row = latest[0];
  const html = row?.renderedHtml ?? '';
  const themed = getThemedPreviews();
  const themedPreviews = themed && row && themed.digestId === row.id ? themed.previews : null;
  const defaultThemeId = ctx.config.newsletter.theme;
  const defaultLayoutId = ctx.config.newsletter.layout;
  const recipientCount = ctx.db
    .select()
    .from(recipientsCache)
    .all()
    .filter(r => r.active).length;

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Preview"
        description="Render the digest as a dry-run, inspect it, then send when it’s ready. Sending is irreversible."
        actions={
          <form action={generate}>
            <SubmitButton variant="secondary" pendingLabel="Generating…">
              <RefreshIcon /> Generate fresh preview
            </SubmitButton>
          </form>
        }
      />

      {row ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Subject</div>
            <div className="mt-2 line-clamp-2 text-[14px] font-medium tracking-[-0.005em] text-fg">
              {row.renderedSubject ?? <span className="text-muted">(none)</span>}
            </div>
          </Card>
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Items</div>
            <div className="mt-2 font-display text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg">
              {row.itemCount}
            </div>
            <div className="mt-1.5 text-[12px] text-muted">
              {formatDateTime(row.windowStart)} → {formatDateTime(row.windowEnd)}
            </div>
          </Card>
          <Card>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Rendered</div>
            <div className="mt-2 text-[14px] text-fg">{formatRelative(row.scheduledAt)}</div>
            <div className="mt-1.5 text-[12px] text-muted">{formatDateTime(row.scheduledAt)}</div>
          </Card>
        </div>
      ) : null}

      {html ? (
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Badge tone="info" dot>
                preview
              </Badge>
              <span className="text-[12px] text-muted">
                Renders the same HTML recipients will see.
              </span>
            </div>
            <div className="text-[11px] text-faint">dry-run</div>
          </div>
          {themedPreviews ? (
            <PreviewSwitcher
              previews={themedPreviews}
              defaultThemeId={defaultThemeId}
              defaultLayoutId={defaultLayoutId}
              defaultTestEmail={ctx.env.ADMIN_EMAIL ?? ''}
              recipientCount={recipientCount}
            />
          ) : (
            <iframe
              srcDoc={html}
              title="Digest preview"
              className="block h-[820px] w-full rounded-b-[10px] bg-white"
            />
          )}
        </Card>
      ) : (
        <EmptyState
          icon={<MailIcon />}
          title="No preview rendered yet"
          description="Click “Generate fresh preview” to compile the next digest as a dry-run. Nothing is sent to recipients."
        />
      )}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.5" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
