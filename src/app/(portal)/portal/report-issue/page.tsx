import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { getBuiltinPortalPage } from '@/modules/portal/pages';
import { getPortalVariables } from '@/modules/portal/variables';
import { getPortalBasePath } from '@/modules/portal/base-path';
import { PortalContentPage } from '../_components/portal-content-page';

export const dynamic = 'force-dynamic';

export default async function ReportIssuePage() {
  const ctx = getAppContext();
  const vars = getPortalVariables(ctx.portal, ctx.config.newsletter);
  const page = getBuiltinPortalPage('report_issue', ctx.portal, vars);
  if (!page) notFound();

  const basePath = await getPortalBasePath();
  const { copy } = ctx.portal;
  return (
    <PortalContentPage
      title={page.title}
      eyebrow={ctx.portal.pages.report_issue.eyebrow}
      html={page.html}
      serverName={ctx.config.newsletter.from.name}
      homeHref={basePath || '/'}
      tocHeading={copy.tocHeading}
      backLabel={copy.backLabel}
      stuckCard={null}
    />
  );
}
