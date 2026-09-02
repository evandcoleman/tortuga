import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { getBuiltinPortalPage } from '@/modules/portal/pages';
import { getPortalVariables } from '@/modules/portal/variables';
import { getPortalBasePath } from '@/modules/portal/base-path';
import { PortalContentPage } from '../_components/portal-content-page';

export const dynamic = 'force-dynamic';

export default async function GettingStartedPage() {
  const ctx = getAppContext();
  const vars = getPortalVariables(ctx.portal, ctx.config.newsletter);
  const page = getBuiltinPortalPage('getting_started', ctx.portal, vars);
  if (!page) notFound();

  const basePath = await getPortalBasePath();
  const reportIssueHref = ctx.portal.pages.report_issue.enabled ? `${basePath}/report-issue` : null;
  return (
    <PortalContentPage
      title={page.title}
      kind="Guide"
      html={page.html}
      homeHref={basePath || '/'}
      reportIssueHref={reportIssueHref}
    />
  );
}
