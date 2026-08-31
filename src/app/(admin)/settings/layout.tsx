import { PageHeader } from '../_components/ui';
import { SettingsNav } from './_components/SettingsNav';
import { RevertButton } from './_components/RevertButton';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Configuration"
        description="Changes are saved to this instance and applied immediately — no restart needed."
        actions={<RevertButton />}
      />
      <SettingsNav />
      {children}
    </div>
  );
}
