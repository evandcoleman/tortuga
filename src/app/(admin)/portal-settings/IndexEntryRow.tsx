'use client';

import { useId } from 'react';
import type { PortalEntry } from '@/kernel/config/schema';
import { DEFAULT_BUILTIN_LINK_COPY, DEFAULT_BUILTIN_PAGE_COPY } from '@/modules/portal/copy';
import { PageBodyEditor } from './PageBodyEditor';

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[13.5px] text-fg focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30';

const MAX_DESCRIPTION_LENGTH = 140;

const BADGE: Record<PortalEntry['type'], string> = {
  builtin_page: 'Built-in page',
  builtin_link: 'Built-in link',
  link: 'Link',
  page: 'Page',
};

/** Human name of a built-in entry's target, shown next to its type badge. */
function builtinName(entry: Extract<PortalEntry, { type: 'builtin_page' | 'builtin_link' }>): string {
  return entry.type === 'builtin_page'
    ? DEFAULT_BUILTIN_PAGE_COPY[entry.page].label
    : DEFAULT_BUILTIN_LINK_COPY[entry.link].label;
}

/** Default label/description placeholders for a built-in row; `undefined` for custom rows (no fallback copy). */
function builtinDefaults(entry: PortalEntry): { label?: string; description?: string } {
  if (entry.type === 'builtin_page') return DEFAULT_BUILTIN_PAGE_COPY[entry.page];
  if (entry.type === 'builtin_link') return DEFAULT_BUILTIN_LINK_COPY[entry.link];
  return {};
}

interface IndexEntryRowProps {
  entry: PortalEntry;
  index: number;
  total: number;
  error?: string;
  onChange: (patch: Partial<PortalEntry>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function IndexEntryRow({ entry, index, total, error, onChange, onRemove, onMoveUp, onMoveDown }: IndexEntryRowProps) {
  const bodyId = useId();
  const isBuiltin = entry.type === 'builtin_page' || entry.type === 'builtin_link';
  const defaults = builtinDefaults(entry);
  const isVisible = !entry.hidden;

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          <span className="rounded-full border border-line px-2 py-0.5 text-accent">{BADGE[entry.type]}</span>
          {isBuiltin ? builtinName(entry) : null}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] normal-case tracking-normal text-muted">
            <input
              className="h-3.5 w-3.5 rounded border-line bg-canvas accent"
              type="checkbox"
              checked={isVisible}
              onChange={e => onChange({ hidden: !e.target.checked })}
            />
            Visible
          </label>
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:text-fg disabled:opacity-30" aria-label="Move up">
            ↑
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:text-fg disabled:opacity-30" aria-label="Move down">
            ↓
          </button>
          {!isBuiltin ? (
            <button type="button" onClick={onRemove} className="rounded px-1.5 py-0.5 text-[11px] text-danger hover:bg-danger/10" aria-label="Remove entry">
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Label</span>
          <input
            className={inputCls}
            value={entry.type === 'link' || entry.type === 'page' ? entry.label : (entry.label ?? '')}
            placeholder={defaults.label}
            onChange={e =>
              isBuiltin ? onChange({ label: e.target.value || undefined }) : onChange({ label: e.target.value })
            }
          />
        </label>

        {entry.type === 'page' ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Slug</span>
            <input className={inputCls} value={entry.slug} placeholder="e.g. faq" onChange={e => onChange({ slug: e.target.value })} />
          </label>
        ) : null}

        {entry.type === 'link' ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">URL</span>
            <input className={inputCls} value={entry.url} placeholder="https://…" onChange={e => onChange({ url: e.target.value })} />
          </label>
        ) : null}
      </div>

      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
          Description <span className="normal-case text-faint/70">(optional, shown on the home index)</span>
        </span>
        <input
          className={inputCls}
          value={entry.description ?? ''}
          placeholder={defaults.description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={e => onChange({ description: e.target.value || undefined })}
        />
      </label>

      {entry.type === 'page' ? <PageBodyEditor entry={entry} bodyId={bodyId} onChange={onChange} /> : null}

      {error ? <p className="mt-1.5 text-[11.5px] text-danger">{error}</p> : null}
    </div>
  );
}
