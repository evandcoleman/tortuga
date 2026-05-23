import { getAppContext } from '@/kernel/context';
import { revertToFileDefault } from './actions';
import { SettingsForm } from './SettingsForm';
import { Badge, Button, Card, CardHeader, PageHeader } from '../_components/ui';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const ctx = getAppContext();
  const cfg = ctx.config.newsletter;
  const env = ctx.env;

  const secrets: Array<{ label: string; set: boolean }> = [
    { label: 'Resend API key', set: Boolean(env.RESEND_API_KEY) },
    { label: 'Mailgun API key', set: Boolean(env.MAILGUN_API_KEY) },
    { label: 'Anthropic API key', set: Boolean(env.ANTHROPIC_API_KEY) },
    { label: 'OpenAI API key', set: Boolean(env.OPENAI_API_KEY) },
    { label: 'TMDB API key', set: Boolean(env.TMDB_API_KEY) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Newsletter configuration"
        description="Changes are saved to this instance and applied immediately — no restart needed."
        actions={
          <form action={revertToFileDefault}>
            <Button type="submit" variant="ghost">Revert to file default</Button>
          </form>
        }
      />

      <SettingsForm config={cfg} />

      <div className="mt-6">
        <Card>
          <CardHeader title="Provider status" description="Secrets are managed in Vault and shown read-only here." />
          <ul className="grid gap-2 sm:grid-cols-2">
            {secrets.map(s => (
              <li key={s.label} className="flex items-center justify-between rounded-md bg-elevated/50 px-3 py-2">
                <span className="text-[13px] text-muted">{s.label}</span>
                <Badge tone={s.set ? 'success' : 'neutral'} dot>{s.set ? 'Set' : 'Not set'}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
