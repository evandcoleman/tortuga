import type { ResolvedPortalCopy } from '@/kernel/config/portal';

export interface PortalStuckCard {
  title: string;
  body: string;
  linkLabel: string;
  href: string;
}

/**
 * Builds the stuck sidebar card shown on content pages, or `null` when it
 * should be hidden — either because `copy.show_stuck_card` is `false`, or
 * because the report-issue page itself is disabled (`reportIssueHref` is
 * `null`, which also covers the report-issue page not linking to itself).
 */
export function buildStuckCard(copy: ResolvedPortalCopy, reportIssueHref: string | null): PortalStuckCard | null {
  if (!copy.showStuckCard || !reportIssueHref) return null;
  return { title: copy.stuckTitle, body: copy.stuckBody, linkLabel: copy.stuckLinkLabel, href: reportIssueHref };
}
