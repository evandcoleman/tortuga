'use client';

import type {
  ItemDisplay,
  HeaderConfig,
  FooterConfig,
} from '@/modules/newsletter/appearance/schema';

// ---------------------------------------------------------------------------
// Item Display
// ---------------------------------------------------------------------------

interface ItemDisplayEditorProps {
  value: ItemDisplay;
  onChange: (next: ItemDisplay) => void;
}

export function ItemDisplayEditor({ value, onChange }: ItemDisplayEditorProps) {
  function set<K extends keyof ItemDisplay>(key: K, val: ItemDisplay[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-faint">
        Controls how each item is rendered inside library sections.
      </p>

      <div className="space-y-2">
        <CheckRow
          label="Show poster image"
          checked={value.show_poster !== false}
          onChange={v => set('show_poster', v)}
        />
        <CheckRow
          label="Show star rating"
          checked={value.show_rating !== false}
          onChange={v => set('show_rating', v)}
        />
        <CheckRow
          label="Show overview text"
          checked={value.show_overview !== false}
          onChange={v => set('show_overview', v)}
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
          Overview max characters (blank = default)
        </label>
        <input
          type="number"
          min={0}
          max={1000}
          value={value.overview_max_chars ?? ''}
          placeholder="Default"
          onChange={e => {
            const raw = e.target.value;
            set('overview_max_chars', raw === '' ? undefined : parseInt(raw, 10));
          }}
          disabled={value.show_overview === false}
          className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
          Poster scale
        </label>
        <div className="flex gap-2">
          {(['sm', 'md', 'lg'] as const).map(scale => (
            <button
              key={scale}
              type="button"
              onClick={() => set('poster_scale', scale)}
              aria-pressed={value.poster_scale === scale}
              disabled={value.show_poster === false}
              className={[
                'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                value.poster_scale === scale
                  ? 'bg-accent text-accent-ink'
                  : 'bg-transparent text-muted hover:bg-surface hover:text-fg',
                'disabled:opacity-40',
              ].join(' ')}
            >
              {scale === 'sm' ? 'Small' : scale === 'md' ? 'Medium' : 'Large'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header Config
// ---------------------------------------------------------------------------

interface HeaderEditorProps {
  value: HeaderConfig;
  onChange: (next: HeaderConfig) => void;
}

export function HeaderEditor({ value, onChange }: HeaderEditorProps) {
  function set<K extends keyof HeaderConfig>(key: K, val: HeaderConfig[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
          Eyebrow text (blank = default)
        </label>
        <input
          type="text"
          value={value.eyebrow ?? ''}
          placeholder="e.g. Plex · Weekly"
          maxLength={120}
          onChange={e => set('eyebrow', e.target.value || undefined)}
          className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
          Headline title (blank = default)
        </label>
        <input
          type="text"
          value={value.title ?? ''}
          placeholder="e.g. Fresh Picks"
          maxLength={160}
          onChange={e => set('title', e.target.value || undefined)}
          className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="space-y-2">
        <CheckRow
          label="Show item count"
          checked={value.show_count !== false}
          onChange={v => set('show_count', v)}
        />
        <CheckRow
          label="Show date range"
          checked={value.show_date_range !== false}
          onChange={v => set('show_date_range', v)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer Config
// ---------------------------------------------------------------------------

interface FooterEditorProps {
  value: FooterConfig;
  onChange: (next: FooterConfig) => void;
}

export function FooterEditor({ value, onChange }: FooterEditorProps) {
  function set<K extends keyof FooterConfig>(key: K, val: FooterConfig[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
          Footer text (optional)
        </label>
        <textarea
          value={value.text ?? ''}
          placeholder="Custom footer message…"
          maxLength={500}
          rows={2}
          onChange={e => set('text', e.target.value || undefined)}
          className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>
      <CheckRow
        label="Show app label"
        checked={value.show_app_label !== false}
        onChange={v => set('show_app_label', v)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent"
      />
      {label}
    </label>
  );
}
