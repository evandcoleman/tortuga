import Link from 'next/link';
import { splitLead, addHeadingIds } from '@/modules/portal/render';
import { ArrowLeftIcon } from '@/modules/portal/icons';
import type { PortalStuckCard } from '@/modules/portal/stuck-card';
import { PortalHeaderRow } from './portal-header-row';

export interface PortalContentPageProps {
  title: string;
  /** The eyebrow label above the title (page's configured/default eyebrow, or the custom-page eyebrow). */
  eyebrow: string;
  /** Already-rendered HTML (substitution + markdown, or admin-authored HTML — both trusted). */
  html: string;
  serverName: string;
  homeHref: string;
  tocHeading: string;
  backLabel: string;
  /** `null` hides the "Stuck?" card entirely (report_issue disabled, `show_stuck_card` false, or this *is* the report-issue page). */
  stuckCard: PortalStuckCard | null;
}

/** Shared masthead chrome for the three built-in content pages and custom pages. */
export function PortalContentPage({
  title,
  eyebrow,
  html,
  serverName,
  homeHref,
  tocHeading,
  backLabel,
  stuckCard,
}: PortalContentPageProps) {
  const { lead, rest } = splitLead(html);
  const { html: body, toc } = addHeadingIds(rest);

  return (
    <article>
      <PortalHeaderRow
        serverName={serverName}
        right={
          <Link
            href={homeHref}
            className="flex items-center gap-2 text-[13px]"
            style={{ color: 'var(--portal-muted)' }}
          >
            <ArrowLeftIcon width={16} height={16} />
            <span>{backLabel}</span>
          </Link>
        }
      />

      <div
        className="flex flex-col gap-4 pt-10 pb-10 sm:gap-5 sm:pt-16 sm:pb-12"
        style={{ borderBottom: '1px solid var(--portal-rule)' }}
      >
        <span className="text-xs tracking-[0.15em]" style={{ color: 'var(--portal-accent)' }}>
          {eyebrow}
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
        {toc.length > 0 || stuckCard ? (
          <div className="flex flex-col gap-0 lg:sticky lg:top-8 lg:self-start">
            {toc.length > 0 ? (
              <>
                <span
                  className="pb-3 text-xs tracking-[0.15em] uppercase"
                  style={{ color: 'var(--portal-muted)' }}
                >
                  {tocHeading}
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
            {stuckCard ? (
              <div
                className="mt-8 flex flex-col gap-2 p-5"
                style={{
                  backgroundColor: 'var(--portal-card-bg)',
                  border: '1px solid var(--portal-rule)',
                  borderRadius: 'var(--portal-radius)',
                }}
              >
                <span className="text-lg" style={{ fontFamily: 'var(--portal-font-heading)' }}>
                  {stuckCard.title}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: 'var(--portal-muted)' }}>
                  {stuckCard.body}
                </span>
                <Link href={stuckCard.href} className="text-sm" style={{ color: 'var(--portal-accent)' }}>
                  {stuckCard.linkLabel} →
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
