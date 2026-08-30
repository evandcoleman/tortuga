import { getAppContext } from '@/kernel/context';
import { GeneralForm } from './GeneralForm';

export const dynamic = 'force-dynamic';

export default function GeneralSettingsPage() {
  const ctx = getAppContext();
  return <GeneralForm config={ctx.config.newsletter} />;
}
