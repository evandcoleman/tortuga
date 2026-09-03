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
        description="Configure the small branded public site (buttons + a few content pages) served on your own domain."
        actions={
          <a
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] font-medium text-gold hover:opacity-90"
          >
            Preview portal ↗
          </a>
        }
      />
      <PortalForm config={ctx.config.portal} />
    </div>
  );
}
