import { getAppContext } from '@/kernel/context';
import { readServiceSettings } from '@/kernel/config/service-settings';
import { EmailForm } from './EmailForm';

export const dynamic = 'force-dynamic';

export default function EmailSettingsPage() {
  const ctx = getAppContext();
  const settings = readServiceSettings(ctx.db, ctx.env);

  return (
    <EmailForm
      config={ctx.config.newsletter}
      secretSources={{
        'resend.api_key': settings['resend.api_key'].source,
        'resend.webhook_secret': settings['resend.webhook_secret'].source,
        'mailgun.api_key': settings['mailgun.api_key'].source,
        'mailgun.webhook_signing_key': settings['mailgun.webhook_signing_key'].source,
      }}
    />
  );
}
