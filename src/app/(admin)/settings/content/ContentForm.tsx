'use client';

import { useActionState } from 'react';
import type { NewsletterConfig } from '@/kernel/config/schema';
import type { MaintainerrCollection } from '@/kernel/integrations/maintainerr';
import { Button, Card, CardHeader } from '../../_components/ui';
import { TextField, NumberField, TextareaField, SelectField, CheckboxField } from '../fields';
import { saveContentSettings, type SaveState } from './actions';
import { missingExcludedIds } from './leaving-exclusions';

const initial: SaveState = { status: 'idle' };

export type LeavingCollectionsResult =
  | { ok: true; collections: MaintainerrCollection[] }
  | { ok: false };

export function ContentForm({
  config,
  leavingCollections,
}: {
  config: NewsletterConfig;
  /** null when Maintainerr isn't configured; { ok: false } when the live fetch failed. */
  leavingCollections: LeavingCollectionsResult | null;
}) {
  const [state, action, pending] = useActionState(saveContentSettings, initial);
  const err = state.status === 'error' ? state.errors : {};

  return (
    <form action={action} className="grid gap-5">
      <Card>
        <CardHeader title="Filters" />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField name="filters.min_tmdb_rating" label="Min TMDB rating" defaultValue={config.filters.min_tmdb_rating} step="0.1" min={0} max={10} error={err['filters.min_tmdb_rating']} />
          <NumberField name="filters.max_items_per_section" label="Max items per section" defaultValue={config.filters.max_items_per_section} min={1} error={err['filters.max_items_per_section']} />
          <NumberField
            name="filters.max_items_leaving_soon"
            label="Max items in leaving soon"
            defaultValue={config.filters.max_items_leaving_soon}
            min={1}
            placeholder="Uncapped"
            hint="Blank = uncapped."
            error={err['filters.max_items_leaving_soon']}
          />
          <TextField name="filters.exclude_genres" label="Exclude genres" defaultValue={config.filters.exclude_genres.join(', ')} hint="Comma or newline separated." />
          <TextField name="include_libraries" label="Include libraries" defaultValue={(config.include_libraries ?? []).join(', ')} hint="Blank = all libraries." />
        </div>
        <div className="mt-2">
          <CheckboxField name="filters.dedupe_episodes_into_seasons" label="Group episodes into seasons" defaultChecked={config.filters.dedupe_episodes_into_seasons} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Leaving soon (Maintainerr)" />
        <p className="text-[12px] text-muted">Surface a section for media Maintainerr will delete soon.</p>
        {leavingCollections === null ? (
          <>
            <p className="text-[13px] text-muted">
              Connect Maintainerr in <span className="text-fg">Settings → Services</span> to enable this feature.
            </p>
            {/* Round-trip config the UI doesn't surface here, so saving other
                settings never drops it. */}
            <input type="hidden" name="leaving.enabled" value={config.leaving.enabled ? 'on' : ''} />
            <input type="hidden" name="leaving.days" value={config.leaving.days} />
            <input type="hidden" name="leaving.heading" value={config.leaving.heading} />
            {config.leaving.excluded_collection_ids.map(id => (
              <input key={id} type="hidden" name="leaving.excluded_collection_ids" value={id} />
            ))}
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                name="leaving.days"
                label="Days before removal"
                defaultValue={config.leaving.days}
                min={1}
                max={90}
                error={err['leaving.days']}
              />
              <TextField
                name="leaving.heading"
                label="Section heading"
                defaultValue={config.leaving.heading}
                error={err['leaving.heading']}
              />
            </div>
            <div className="mt-2">
              <CheckboxField
                name="leaving.enabled"
                label="Show the leaving soon section"
                defaultChecked={config.leaving.enabled}
              />
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                Excluded collections
              </span>
              {!leavingCollections.ok ? (
                <>
                  <p className="text-[12px] text-danger">
                    Could not load collections from Maintainerr. Existing exclusions are kept as-is.
                  </p>
                  {config.leaving.excluded_collection_ids.length > 0 ? (
                    <p className="mt-1 text-[12px] text-muted">
                      Currently excluded IDs: {config.leaving.excluded_collection_ids.join(', ')}
                    </p>
                  ) : null}
                  {config.leaving.excluded_collection_ids.map(id => (
                    <input key={id} type="hidden" name="leaving.excluded_collection_ids" value={id} />
                  ))}
                </>
              ) : leavingCollections.collections.length === 0 ? (
                <>
                  <p className="text-[12px] text-muted">No Maintainerr collections have removal rules yet.</p>
                  {config.leaving.excluded_collection_ids.map(id => (
                    <input key={id} type="hidden" name="leaving.excluded_collection_ids" value={id} />
                  ))}
                </>
              ) : (
                <>
                  <ul className="grid gap-1.5">
                    {leavingCollections.collections.map(c => (
                      <li key={c.id}>
                        <label className="flex items-start gap-2.5 py-1">
                          <input
                            className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent-gold"
                            type="checkbox"
                            name="leaving.excluded_collection_ids"
                            value={c.id}
                            defaultChecked={config.leaving.excluded_collection_ids.includes(c.id)}
                          />
                          <span className="text-[13.5px] text-fg">
                            {c.title} <span className="text-muted">· deletes after {c.deleteAfterDays} days</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {/* Stored exclusions for collections no longer in the rendered
                      checklist (deleted, or type changed) still round-trip. */}
                  {missingExcludedIds(
                    config.leaving.excluded_collection_ids,
                    leavingCollections.collections.map(c => c.id),
                  ).map(id => (
                    <input key={id} type="hidden" name="leaving.excluded_collection_ids" value={id} />
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Commentary" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="commentary.provider" label="Provider" defaultValue={config.commentary.provider}
            options={[{ value: 'anthropic', label: 'Anthropic' }, { value: 'openai', label: 'OpenAI' }]} />
          <TextField name="commentary.model" label="Model (optional)" defaultValue={config.commentary.model} hint="Blank uses the provider default." />
        </div>
        <div className="mt-2"><CheckboxField name="commentary.enabled" label="Enable AI intro" defaultChecked={config.commentary.enabled} /></div>
        <div className="mt-4"><TextareaField name="commentary.voice" label="Voice" defaultValue={config.commentary.voice} rows={3} /></div>
        <div className="mt-2"><CheckboxField name="commentary.disclaimer" label="Show &ldquo;Generated by AI&rdquo; disclaimer" defaultChecked={config.commentary.disclaimer} hint="Adds a small label under the intro." /></div>
      </Card>

      <Card>
        <CardHeader title="Extras" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="extras.request_url" label="Request URL" type="url" defaultValue={config.extras?.request_url ?? ''} error={err['extras.request_url']} />
          <TextField name="extras.request_label" label="Request label" defaultValue={config.extras?.request_label ?? 'Request a title'} />
          <TextField name="extras.personal_url" label="Personal URL" type="url" defaultValue={config.extras?.personal_url ?? ''} error={err['extras.personal_url']} />
          <TextField name="extras.personal_label" label="Personal label" defaultValue={config.extras?.personal_label ?? ''} />
        </div>
        <div className="mt-4"><TextareaField name="extras.freeform_markdown" label="Footer note" defaultValue={config.extras?.freeform_markdown ?? ''} rows={2} /></div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Save content settings'}</Button>
        {state.status === 'success' ? <span className="text-[13px] text-success">Saved and reloaded.</span> : null}
        {state.status === 'error' ? <span className="text-[13px] text-danger">Fix the highlighted fields.</span> : null}
      </div>
    </form>
  );
}
