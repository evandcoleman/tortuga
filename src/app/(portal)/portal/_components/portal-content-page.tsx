import Link from 'next/link';
import { splitLead, addHeadingIds } from '@/modules/portal/render';
import { ArrowLeftIcon } from '@/modules/portal/icons';

export type PortalPageKind = 'Guide' | 'Rules' | 'Help' | 'Page';

export interface PortalContentPageProps {
  title: string;
  kind: PortalPageKind;
  /** Already-rendered HTML (substitution + markdown, or admin-authored HTML — both trusted). */
  html: string;
  homeHref: string;
  /**
   * Href for the "Stuck?" card's report-issue link, or `null` to hide the
   * card entirely (report-issue disabled, or this *is* the report-issue page).
   */
  reportIssueHref: string | null;
}

/** Shared masthead chrome for the three built-in content pages and custom pages. */
export function PortalContentPage({ title, kind, html, homeHref, reportIssueHref }: PortalContentPageProps) {
  const { lead, rest } = splitLead(html);
  const { html: body, toc } = addHeadingIds(rest);

  return (
    <article>
      <div className="flex items-center justify-end pt-7 pb-0">
        <Link
          href={homeHref}
          className="flex items-center gap-2 text-[13px]"
          style={{ color: 'var(--portal-muted)' }}
        >
          <ArrowLeftIcon width={16} height={16} />
          <span>Back to index</span>
        </Link>
      </div>

      <div
        className="flex flex-col gap-4 pt-10 pb-10 sm:gap-5 sm:pt-16 sm:pb-12"
        style={{ borderBottom: '1px solid var(--portal-rule)' }}
      >
        <span className="text-xs tracking-[0.15em]" style={{ color: 'var(--portal-accent)' }}>
          {kind}
        </span>
        <h1
          className="m-0 text-[44px] leading-[0.95] font-semibold tracking-[-0.03em] sm:text-[96px]"
          style={{ fontFamily: 'var(--portal-font-heading)' }}
        >
          {title}
        </h1>
        {lead ? (
          <p
            className="m-0 max-w-[640px] text-lg italic sm:text-[22px]"
            style={{ fontFamily: 'var(--portal-font-heading)', color: 'var(--portal-muted)', lineHeight: 1.4 }}
            dangerouslySetInnerHTML={{ __html: lead }}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-24">
        {toc.length > 0 || reportIssueHref ? (
          <div className="flex flex-col gap-0 lg:sticky lg:top-8 lg:self-start">
            {toc.length > 0 ? (
              <>
                <span
                  className="pb-3 text-xs tracking-[0.15em] uppercase"
                  style={{ color: 'var(--portal-muted)' }}
                >
                  On this page
                </span>
                {toc.map((entry) => (
                  <a
                    key={entry.id}
                    href={`#${entry.id}`}
                    className="py-3.5 text-[15px]"
                    style={{ borderTop: '1px solid var(--portal-rule)', color: 'var(--portal-muted)' }}
                  >
                    {entry.text}
                  </a>
                ))}
              </>
            ) : null}
            {reportIssueHref ? (
              <div
                className="mt-8 flex flex-col gap-2 p-5"
                style={{
                  backgroundColor: 'var(--portal-card-bg)',
                  border: '1px solid var(--portal-rule)',
                  borderRadius: 'var(--portal-radius)',
                }}
              >
                <span className="text-lg" style={{ fontFamily: 'var(--portal-font-heading)' }}>
                  Stuck?
                </span>
                <span className="text-sm leading-relaxed" style={{ color: 'var(--portal-muted)' }}>
                  Report an issue and include what you were trying to watch.
                </span>
                <Link href={reportIssueHref} className="text-sm" style={{ color: 'var(--portal-accent)' }}>
                  Report an issue →
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className="portal-prose max-w-[760px]"
          style={{ fontFamily: 'var(--portal-font-body)' }}
          // Content is either the app's own rendered markdown or admin-authored HTML — both trusted (see spec).
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </article>
  );
}
