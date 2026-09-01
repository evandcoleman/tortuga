import { getAppContext } from '@/kernel/context';
import { PortalForm } from './PortalForm';

export const dynamic = 'force-dynamic';

export default function PortalSettingsPage() {
  const ctx = getAppContext();
  return <PortalForm config={ctx.config.portal} />;
}
