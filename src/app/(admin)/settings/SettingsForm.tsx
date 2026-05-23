'use client';

import { useActionState } from 'react';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { Button, Card, CardHeader } from '../_components/ui';
import { saveSettings, type SaveState } from './actions';
import { TextField, NumberField, TextareaField, SelectField, CheckboxField } from './fields';

const initial: SaveState = { status: 'idle' };

export function SettingsForm({ config }: { config: NewsletterConfig }) {
  const [state, action, pending] = useActionState(saveSettings, initial);
  const err = state.status === 'error' ? state.errors : {};

  return (
    <form action={action} className="grid gap-5">
      <Card>
        <CardHeader title="Schedule" description="When the digest is generated and sent." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="schedule" label="Cron" defaultValue={config.schedule} error={err['schedule']} hint="e.g. 0 9 * * SUN" />
          <TextField name="timezone" label="Timezone" defaultValue={config.timezone} error={err['timezone']} />
          <NumberField name="lookback_days" label="Lookback days" defaultValue={config.lookback_days} min={1} error={err['lookback_days']} />
        </div>
        <div className="mt-2">
          <CheckboxField name="schedule_enabled" label="Scheduled sends enabled" defaultChecked={config.schedule_enabled} hint="Off pauses the cron without losing settings." />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sender & Email" description="Identity and delivery provider." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="from.email" label="From email" type="email" defaultValue={config.from.email} error={err['from.email']} />
          <TextField name="from.name" label="From name" defaultValue={config.from.name} error={err['from.name']} />
          <TextField name="reply_to" label="Reply-to (optional)" type="email" defaultValue={config.reply_to ?? ''} error={err['reply_to']} />
          <SelectField name="email.provider" label="Provider" defaultValue={config.email.provider}
            options={[{ value: 'resend', label: 'Resend' }, { value: 'mailgun', label: 'Mailgun' }]} />
          <TextField name="email.mailgun.domain" label="Mailgun domain" defaultValue={config.email.mailgun?.domain ?? ''} error={err['email.mailgun.domain']} hint="Required when provider is Mailgun." />
          <SelectField name="email.mailgun.region" label="Mailgun region" defaultValue={config.email.mailgun?.region ?? 'us'}
            options={[{ value: 'us', label: 'US' }, { value: 'eu', label: 'EU' }]} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Filters" description="What content makes it into the digest." />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField name="filters.min_tmdb_rating" label="Min TMDB rating" defaultValue={config.filters.min_tmdb_rating} step="0.1" min={0} max={10} error={err['filters.min_tmdb_rating']} />
          <NumberField name="filters.max_items_per_section" label="Max items per section" defaultValue={config.filters.max_items_per_section} min={1} error={err['filters.max_items_per_section']} />
          <TextField name="filters.exclude_genres" label="Exclude genres" defaultValue={config.filters.exclude_genres.join(', ')} hint="Comma or newline separated." />
          <TextField name="include_libraries" label="Include libraries" defaultValue={(config.include_libraries ?? []).join(', ')} hint="Blank = all libraries." />
        </div>
        <div className="mt-2">
          <CheckboxField name="filters.dedupe_episodes_into_seasons" label="Group episodes into seasons" defaultChecked={config.filters.dedupe_episodes_into_seasons} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Commentary" description="AI-generated editorial intro." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="commentary.provider" label="Provider" defaultValue={config.commentary.provider}
            options={[{ value: 'anthropic', label: 'Anthropic' }, { value: 'openai', label: 'OpenAI' }]} />
          <TextField name="commentary.model" label="Model (optional)" defaultValue={config.commentary.model} hint="Blank uses the provider default." />
        </div>
        <div className="mt-2"><CheckboxField name="commentary.enabled" label="Enable AI intro" defaultChecked={config.commentary.enabled} /></div>
        <div className="mt-4"><TextareaField name="commentary.voice" label="Voice" defaultValue={config.commentary.voice} rows={3} hint="Freeform tone instructions." /></div>
      </Card>

      <Card>
        <CardHeader title="Extras" description="Optional footer links and notes." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="extras.request_url" label="Request URL" type="url" defaultValue={config.extras?.request_url ?? ''} error={err['extras.request_url']} />
          <TextField name="extras.request_label" label="Request label" defaultValue={config.extras?.request_label ?? 'Request a title'} />
          <TextField name="extras.personal_url" label="Personal URL" type="url" defaultValue={config.extras?.personal_url ?? ''} error={err['extras.personal_url']} />
          <TextField name="extras.personal_label" label="Personal label" defaultValue={config.extras?.personal_label ?? ''} />
        </div>
        <div className="mt-4"><TextareaField name="extras.freeform_markdown" label="Footer note" defaultValue={config.extras?.freeform_markdown ?? ''} rows={2} /></div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
        {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
        {state.status === 'error' ? <span className="text-[13px] text-danger">Fix the highlighted fields.</span> : null}
      </div>
    </form>
  );
}
