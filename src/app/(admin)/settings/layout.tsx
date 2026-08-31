import { Button, PageHeader } from '../_components/ui';
import { SettingsNav } from './_components/SettingsNav';
import { revertToFileDefault } from './_lib/revert-action';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Configuration"
        description="Changes are saved to this instance and applied immediately — no restart needed."
        actions={
          <form action={revertToFileDefault}>
            <Button type="submit" variant="ghost">Revert to file default</Button>
          </form>
        }
      />
      <SettingsNav />
      {children}
    </div>
  );
}
