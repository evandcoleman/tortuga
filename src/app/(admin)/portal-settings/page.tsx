import { getAppContext } from '@/kernel/context';
import { PageHeader } from '../_components/ui';
import { PortalForm } from './PortalForm';

export const dynamic = 'force-dynamic';

export default function PortalSettingsPage() {
  const ctx = getAppContext();
  return (
    <div>
      <PageHeader
        eyebrow="Portal"
        title="Portal settings"
        actions={
          <a
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] font-medium text-accent hover:opacity-90"
          >
            Preview portal ↗
          </a>
        }
      />
      <PortalForm config={ctx.config.portal} />
    </div>
  );
}
