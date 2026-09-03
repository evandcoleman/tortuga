import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { getTemplateBySlug } from '@/modules/templates/service';
import { WELCOME_TEMPLATE_SLUG } from '@/modules/templates/welcome-content';
import { PageHeader } from '../../../_components/ui';
import { TemplateEditor } from './TemplateEditor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TemplateEditPage({ params }: PageProps) {
  const { slug } = await params;
  const ctx = getAppContext();
  const template = getTemplateBySlug(ctx.db, slug);
  if (!template) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Messages"
        title={template.name}
      />
      <TemplateEditor
        template={{ slug: template.slug, name: template.name, subject: template.subject, body: template.body }}
        deletable={template.slug !== WELCOME_TEMPLATE_SLUG}
      />
    </div>
  );
}
