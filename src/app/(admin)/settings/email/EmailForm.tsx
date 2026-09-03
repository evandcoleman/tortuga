'use client';

import { useActionState, useState } from 'react';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { Button, Card, CardHeader } from '../../_components/ui';
import { TextField, SelectField, SecretField } from '../fields';
import { TestButton } from '../_components/TestButton';
import { saveEmailSettings, testResend, testMailgun, type SaveState } from './actions';

const initial: SaveState = { status: 'idle' };

export interface EmailSecretSources {
  'resend.api_key': 'env' | 'db' | undefined;
  'resend.webhook_secret': 'env' | 'db' | undefined;
  'mailgun.api_key': 'env' | 'db' | undefined;
  'mailgun.webhook_signing_key': 'env' | 'db' | undefined;
}

export function EmailForm({
  config,
  secretSources,
}: {
  config: NewsletterConfig;
  secretSources: EmailSecretSources;
}) {
  const [state, action, pending] = useActionState(saveEmailSettings, initial);
  const err = state.status === 'error' ? state.errors : {};
  // Tracks the unsaved region select so "Test" pings against what's about to be saved,
  // not the last-persisted config.
  const [mailgunRegion, setMailgunRegion] = useState<'us' | 'eu'>(config.email.mailgun?.region ?? 'us');

  return (
    <form action={action} className="grid gap-5">
      <Card>
        <CardHeader title="Sender & delivery" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="from.email" label="From email" type="email" defaultValue={config.from.email} error={err['from.email']} />
          <TextField name="from.name" label="From name" defaultValue={config.from.name} error={err['from.name']} />
          <TextField name="reply_to" label="Reply-to (optional)" type="email" defaultValue={config.reply_to ?? ''} error={err['reply_to']} />
          <SelectField name="email.provider" label="Provider" defaultValue={config.email.provider}
            options={[{ value: 'resend', label: 'Resend' }, { value: 'mailgun', label: 'Mailgun' }]} />
          <TextField name="email.mailgun.domain" label="Mailgun domain" defaultValue={config.email.mailgun?.domain ?? ''} error={err['email.mailgun.domain']} hint="Required when provider is Mailgun." />
          <SelectField name="email.mailgun.region" label="Mailgun region" defaultValue={config.email.mailgun?.region ?? 'us'}
            options={[{ value: 'us', label: 'US' }, { value: 'eu', label: 'EU' }]}
            onChange={(v) => setMailgunRegion(v === 'eu' ? 'eu' : 'us')} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Resend credentials"
          action={<TestButton action={testResend} />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SecretField name="resend.api_key" label="API key" source={secretSources['resend.api_key']} envVar="RESEND_API_KEY" />
          <SecretField name="resend.webhook_secret" label="Webhook signing secret" source={secretSources['resend.webhook_secret']} envVar="RESEND_WEBHOOK_SECRET" hint="Verifies delivery event webhooks." />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Mailgun credentials"
          action={<TestButton action={() => testMailgun(mailgunRegion)} />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SecretField name="mailgun.api_key" label="API key" source={secretSources['mailgun.api_key']} envVar="MAILGUN_API_KEY" />
          <SecretField name="mailgun.webhook_signing_key" label="Webhook signing key" source={secretSources['mailgun.webhook_signing_key']} envVar="MAILGUN_WEBHOOK_SIGNING_KEY" hint="Verifies delivery event webhooks." />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save email settings'}</Button>
        {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
        {state.status === 'error' ? <span className="text-[13px] text-danger">Fix the highlighted fields.</span> : null}
      </div>
    </form>
  );
}
