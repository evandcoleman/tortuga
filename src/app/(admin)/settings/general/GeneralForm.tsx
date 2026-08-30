'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { Button, Card, CardHeader } from '../../_components/ui';
import { TextField, NumberField, CheckboxField } from '../fields';
import { saveGeneralSettings, type SaveState } from './actions';

const initial: SaveState = { status: 'idle' };

export function GeneralForm({ config }: { config: NewsletterConfig }) {
  const [state, action, pending] = useActionState(saveGeneralSettings, initial);
  const err = state.status === 'error' ? state.errors : {};

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title="Appearance" description="Theme, layout, and block-level customization for the newsletter email." />
        <Link
          href="/newsletter/customize"
          className="text-[13px] font-medium text-gold transition hover:text-gold-hi"
        >
          Open the customize editor →
        </Link>
      </Card>

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
        <CardHeader title="Plex" description="Connects the newsletter to your Plex server for deep-links to titles." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="plex.server_id"
            label="Server ID (optional)"
            defaultValue={config.plex?.server_id ?? ''}
            error={err['plex.server_id']}
            placeholder="e.g. a1b2c3d4e5f6…"
            hint="Powers “Open in Plex” deep-links in the email. Find it in your Plex server under Settings → Manage → Remote Access (the ~40-character Server ID). Leave blank to skip deep-links."
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save general settings'}</Button>
        {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
        {state.status === 'error' ? <span className="text-[13px] text-danger">Fix the highlighted fields.</span> : null}
      </div>
      </form>
    </div>
  );
}
