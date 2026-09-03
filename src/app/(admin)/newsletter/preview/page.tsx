import { and, desc, eq, inArray } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { getThemedPreviews } from '@/modules/newsletter/pipeline/preview-cache';
import { digests, recipientsCache, sends } from '@/modules/newsletter/schema';
import { PreviewSwitcher } from './PreviewSwitcher';
import { GenerateButton } from './GenerateButton';
import { IssueUrlCopy } from './IssueUrlCopy';
import { digestIssueUrl } from './issue-url';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  formatDateTime,
  formatRelative,
} from '../../_components/ui';

export const dynamic = 'force-dynamic';

// Digests in these terminal states have real rendered content worth showing on
// the preview page. 'pending'/'sending'/'skipped' have nothing (yet) to render.
const VISIBLE_STATUSES = ['rendered', 'sent', 'failed'] as const;

export default function Preview() {
  const ctx = getAppContext();
  const latest = ctx.db
    .select()
    .from(digests)
    .where(inArray(digests.status, VISIBLE_STATUSES))
    .orderBy(desc(digests.scheduledAt))
    .limit(1)
    .all();
  const row = latest[0];
  const html = row?.renderedHtml ?? '';
  const themed = getThemedPreviews();
  const themedPreviews = themed && row && themed.digestId === row.id ? themed.previews : null;
  const defaultThemeId = ctx.config.newsletter.theme;
  const defaultLayoutId = ctx.config.newsletter.layout;
  const issueUrl = digestIssueUrl(row, ctx.env.APP_URL);
  const recipientCount = ctx.db
    .select()
    .from(recipientsCache)
    .all()
    .filter(r => r.active).length;
  const sentCount =
    row && row.status === 'sent'
      ? ctx.db
          .select()
          .from(sends)
          .where(and(eq(sends.digestId, row.id), eq(sends.status, 'sent')))
          .all().length
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Preview"
        actions={<GenerateButton />}
      />

      {issueUrl ? (
        <div className="mb-4">
          <IssueUrlCopy url={issueUrl} />
          <p className="mt-1 text-[11px] text-faint">
            {row?.status === 'sent'
              ? 'This page is public now that the issue has been sent.'
              : 'Visible only to signed-in admins until this issue is sent — it becomes public once sent.'}
          </p>
        </div>
      ) : null}

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
              {row?.status === 'sent' ? (
                <Badge tone="success" dot>
                  sent
                </Badge>
              ) : row?.status === 'failed' ? (
                <Badge tone="danger" dot>
                  send failed
                </Badge>
              ) : (
                <Badge tone="info" dot>
                  preview
                </Badge>
              )}
              {row?.status === 'sent' ? (
                <span className="text-[12px] text-muted">
                  Sent to {sentCount} recipient{sentCount === 1 ? '' : 's'}.
                </span>
              ) : row?.status === 'failed' ? (
                <span className="text-[12px] text-muted">The last send failed. Check history for details.</span>
              ) : null}
            </div>
            <div className="text-[11px] text-faint">
              {row?.status === 'rendered' ? 'dry-run' : row ? formatRelative(row.scheduledAt) : null}
            </div>
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
          description="Generate a preview to render the next issue as a dry run."
        />
      )}
    </div>
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
