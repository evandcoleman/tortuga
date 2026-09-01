'use client';

import { useId, useState } from 'react';
import type { PortalCustomEntry } from '@/kernel/config/schema';

interface CustomEntriesEditorProps {
  value: PortalCustomEntry[];
  onChange: (next: PortalCustomEntry[]) => void;
  errors: Record<string, string>;
}

const inputCls =
  'block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[13.5px] text-fg focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30';

function emptyLink(): PortalCustomEntry {
  return { type: 'link', label: '', url: '' };
}

function emptyPage(): PortalCustomEntry {
  return { type: 'page', slug: '', label: '', markdown: '' };
}

/**
 * Add/remove/reorder editor for `portal.custom` entries. Each entry is either
 * an external `link` (home-grid button only) or a `page` (slug + label + a
 * body given as markdown *or* html — exactly one, enforced server-side by
 * `PortalConfigSchema` and surfaced here via `errors`).
 */
export function CustomEntriesEditor({ value, onChange, errors }: CustomEntriesEditorProps) {
  function update(index: number, patch: Partial<PortalCustomEntry>) {
    const next = value.map((entry, i) => (i === index ? ({ ...entry, ...patch } as PortalCustomEntry) : entry));
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {value.map((entry, index) => (
        <CustomEntryRow
          key={index}
          entry={entry}
          index={index}
          total={value.length}
          error={errors[String(index)]}
          onChange={patch => update(index, patch)}
          onRemove={() => remove(index)}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
        />
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange([...value, emptyLink()])}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
        >
          + Add link
        </button>
        <button
          type="button"
          onClick={() => onChange([...value, emptyPage()])}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
        >
          + Add page
        </button>
      </div>
    </div>
  );
}

function CustomEntryRow({
  entry,
  index,
  total,
  error,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: PortalCustomEntry;
  index: number;
  total: number;
  error?: string;
  onChange: (patch: Partial<PortalCustomEntry>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const bodyId = useId();

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          {entry.type === 'page' ? 'Page' : 'Link'} #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:text-fg disabled:opacity-30" aria-label="Move up">
            ↑
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:text-fg disabled:opacity-30" aria-label="Move down">
            ↓
          </button>
          <button type="button" onClick={onRemove} className="rounded px-1.5 py-0.5 text-[11px] text-danger hover:bg-danger/10" aria-label="Remove entry">
            Remove
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Label</span>
          <input className={inputCls} value={entry.label} onChange={e => onChange({ label: e.target.value })} />
        </label>

        {entry.type === 'page' ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Slug</span>
            <input className={inputCls} value={entry.slug} placeholder="e.g. faq" onChange={e => onChange({ slug: e.target.value })} />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">URL</span>
            <input className={inputCls} value={entry.url} placeholder="https://…" onChange={e => onChange({ url: e.target.value })} />
          </label>
        )}
      </div>

      {entry.type === 'page' ? (
        <PageBodyEditor entry={entry} bodyId={bodyId} onChange={onChange} />
      ) : null}

      {error ? <p className="mt-1.5 text-[11.5px] text-danger">{error}</p> : null}
    </div>
  );
}

function PageBodyEditor({
  entry,
  bodyId,
  onChange,
}: {
  entry: Extract<PortalCustomEntry, { type: 'page' }>;
  bodyId: string;
  onChange: (patch: Partial<PortalCustomEntry>) => void;
}) {
  const bodyMode: 'markdown' | 'html' = typeof entry.html === 'string' && entry.html.length > 0 ? 'html' : 'markdown';

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Body</span>
        <div className="flex gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => onChange({ markdown: entry.html ?? '', html: undefined })}
            className={bodyMode === 'markdown' ? 'font-semibold text-gold' : 'text-muted hover:text-fg'}
          >
            Markdown
          </button>
          <span className="text-faint">/</span>
          <button
            type="button"
            onClick={() => onChange({ html: entry.markdown ?? '', markdown: undefined })}
            className={bodyMode === 'html' ? 'font-semibold text-gold' : 'text-muted hover:text-fg'}
          >
            HTML
          </button>
        </div>
      </div>
      <textarea
        id={bodyId}
        className={inputCls}
        rows={5}
        value={bodyMode === 'html' ? (entry.html ?? '') : (entry.markdown ?? '')}
        onChange={e => onChange(bodyMode === 'html' ? { html: e.target.value } : { markdown: e.target.value })}
      />
    </div>
  );
}
