import { getAppContext } from '@/kernel/context';
import { readServiceSettings } from '@/kernel/config/service-settings';
import { ServicesForm } from './ServicesForm';

export const dynamic = 'force-dynamic';

export default function ServicesSettingsPage() {
  const ctx = getAppContext();
  const settings = readServiceSettings(ctx.db, ctx.env);

  return (
    <ServicesForm
      values={{
        'tautulli.url': { value: settings['tautulli.url'].value ?? '', source: settings['tautulli.url'].source },
        'tautulli.api_key': { source: settings['tautulli.api_key'].source },
        'tmdb.api_key': { source: settings['tmdb.api_key'].source },
        'maintainerr.url': { value: settings['maintainerr.url'].value ?? '', source: settings['maintainerr.url'].source },
        'anthropic.api_key': { source: settings['anthropic.api_key'].source },
        'openai.api_key': { source: settings['openai.api_key'].source },
      }}
    />
  );
}
