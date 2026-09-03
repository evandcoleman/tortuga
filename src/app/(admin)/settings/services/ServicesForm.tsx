'use client';

import { ManagedTextField, SecretField } from '../fields';
import { ServiceCard } from '../_components/ServiceCard';
import {
  saveTautulliSettings,
  saveTmdbSettings,
  saveMaintainerrSettings,
  saveAnthropicSettings,
  saveOpenaiSettings,
  testTautulli,
  testTmdb,
  testMaintainerr,
  testAnthropic,
  testOpenai,
} from './actions';

export interface ServicesFieldValues {
  'tautulli.url': { value: string; source: 'env' | 'db' | undefined };
  'tautulli.api_key': { source: 'env' | 'db' | undefined };
  'tmdb.api_key': { source: 'env' | 'db' | undefined };
  'maintainerr.url': { value: string; source: 'env' | 'db' | undefined };
  'anthropic.api_key': { source: 'env' | 'db' | undefined };
  'openai.api_key': { source: 'env' | 'db' | undefined };
}

export function ServicesForm({ values }: { values: ServicesFieldValues }) {
  return (
    <div className="grid gap-5">
      <ServiceCard
        title="Tautulli"
        saveAction={saveTautulliSettings}
        testAction={testTautulli}
      >
        <ManagedTextField
          name="tautulli.url"
          label="URL"
          value={values['tautulli.url'].value}
          source={values['tautulli.url'].source}
          envVar="TAUTULLI_URL"
          placeholder="http://tautulli.local:8181"
        />
        <SecretField name="tautulli.api_key" label="API key" source={values['tautulli.api_key'].source} envVar="TAUTULLI_API_KEY" />
      </ServiceCard>

      <ServiceCard
        title="TMDB"
        saveAction={saveTmdbSettings}
        testAction={testTmdb}
      >
        <SecretField name="tmdb.api_key" label="API key" source={values['tmdb.api_key'].source} envVar="TMDB_API_KEY" />
      </ServiceCard>

      <ServiceCard
        title="Maintainerr"
        saveAction={saveMaintainerrSettings}
        testAction={testMaintainerr}
      >
        <ManagedTextField
          name="maintainerr.url"
          label="URL"
          value={values['maintainerr.url'].value}
          source={values['maintainerr.url'].source}
          envVar="MAINTAINERR_URL"
          placeholder="http://maintainerr.local:6246"
        />
      </ServiceCard>

      <ServiceCard
        title="Anthropic"
        hint="Used when Commentary provider is Anthropic."
        saveAction={saveAnthropicSettings}
        testAction={testAnthropic}
      >
        <SecretField name="anthropic.api_key" label="API key" source={values['anthropic.api_key'].source} envVar="ANTHROPIC_API_KEY" />
      </ServiceCard>

      <ServiceCard
        title="OpenAI"
        hint="Used when Commentary provider is OpenAI."
        saveAction={saveOpenaiSettings}
        testAction={testOpenai}
      >
        <SecretField name="openai.api_key" label="API key" source={values['openai.api_key'].source} envVar="OPENAI_API_KEY" />
      </ServiceCard>
    </div>
  );
}
