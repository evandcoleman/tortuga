import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { getCustomPortalPage } from '@/modules/portal/pages';
import { getPortalVariables } from '@/modules/portal/variables';
import { getPortalBasePath } from '@/modules/portal/base-path';
import { PortalContentPage } from '../_components/portal-content-page';

export const dynamic = 'force-dynamic';

export default async function CustomPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = getAppContext();
  const vars = getPortalVariables(ctx.portal, ctx.config.newsletter);
  const page = getCustomPortalPage(ctx.portal, slug, vars);
  if (!page) notFound();

  const basePath = await getPortalBasePath();
  return <PortalContentPage title={page.title} html={page.html} homeHref={basePath || '/'} />;
}
