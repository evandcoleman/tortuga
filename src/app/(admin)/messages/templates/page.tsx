import Link from 'next/link';
import { getAppContext } from '@/kernel/context';
import { listTemplates } from '@/modules/templates/service';
import { WELCOME_TEMPLATE_SLUG } from '@/modules/templates/welcome-content';
import { Badge, Card, EmptyState, PageHeader, TD, TH, THead, TR, Table, formatDateTime } from '../../_components/ui';
import { NewTemplateForm } from './NewTemplateForm';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const ctx = getAppContext();
  const rows = listTemplates(ctx.db).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        eyebrow="Messages"
        title="Templates"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {rows.length === 0 ? (
          <Card>
            <EmptyState title="No templates yet" description="Create your first template to get started." />
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Slug</TH>
                <TH>Subject</TH>
                <TH>Updated</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map(t => (
                <TR key={t.id}>
                  <TD>
                    <Link href={`/messages/templates/${t.slug}`} className="font-medium text-fg hover:text-accent">
                      {t.name}
                    </Link>
                    {t.slug === WELCOME_TEMPLATE_SLUG ? (
                      <Badge tone="accent" className="ml-2">
                        System
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="font-mono text-[12px] text-muted">{t.slug}</TD>
                  <TD className="text-[13px] text-muted">{t.subject}</TD>
                  <TD className="text-[13px] text-muted">{formatDateTime(t.updatedAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        <NewTemplateForm />
      </div>
    </div>
  );
}
