import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { getBuiltinPortalPage } from '@/modules/portal/pages';
import { getPortalVariables } from '@/modules/portal/variables';
import { getPortalBasePath } from '@/modules/portal/base-path';
import { buildStuckCard } from '@/modules/portal/stuck-card';
import { PortalContentPage } from '../_components/portal-content-page';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const ctx = getAppContext();
  const basePath = await getPortalBasePath();
  const vars = getPortalVariables(ctx.portal, ctx.config.newsletter, { basePath });
  const page = getBuiltinPortalPage('rules', ctx.portal, vars);
  if (!page) notFound();

  const { copy } = ctx.portal;
  const reportIssueHref = ctx.portal.pages.report_issue.enabled ? `${basePath}/report-issue` : null;
  const stuckCard = buildStuckCard(copy, reportIssueHref);

  return (
    <PortalContentPage
      title={page.title}
      eyebrow={ctx.portal.pages.rules.eyebrow}
      html={page.html}
      serverName={ctx.config.newsletter.from.name}
      homeHref={basePath || '/'}
      tocHeading={copy.tocHeading}
      backLabel={copy.backLabel}
      stuckCard={stuckCard}
    />
  );
}
