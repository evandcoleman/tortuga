'use client';

import { useState } from 'react';

export interface MatrixPreview {
  themeId: string;
  themeLabel: string;
  layoutId: string;
  layoutLabel: string;
  html: string;
}

interface Option {
  id: string;
  label: string;
}

function uniqueOptions(previews: MatrixPreview[], kind: 'theme' | 'layout'): Option[] {
  const seen = new Map<string, string>();
  for (const p of previews) {
    const id = kind === 'theme' ? p.themeId : p.layoutId;
    const label = kind === 'theme' ? p.themeLabel : p.layoutLabel;
    if (!seen.has(id)) seen.set(id, label);
  }
  return Array.from(seen, ([id, label]) => ({ id, label }));
}

function AxisRow({
  title,
  options,
  activeId,
  onSelect,
}: {
  title: string;
  options: Option[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
      <span className="mr-1 w-14 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        {title}
      </span>
      {options.map(o => {
        const isActive = o.id === activeId;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            aria-pressed={isActive}
            className={[
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              isActive
                ? 'bg-gold text-gold-ink'
                : 'bg-transparent text-muted hover:bg-surface hover:text-fg',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PreviewSwitcher({
  previews,
  defaultThemeId,
  defaultLayoutId,
}: {
  previews: MatrixPreview[];
  defaultThemeId: string;
  defaultLayoutId: string;
}) {
  const themes = uniqueOptions(previews, 'theme');
  const layouts = uniqueOptions(previews, 'layout');

  const [themeId, setThemeId] = useState(
    themes.find(t => t.id === defaultThemeId)?.id ?? themes[0]?.id ?? '',
  );
  const [layoutId, setLayoutId] = useState(
    layouts.find(l => l.id === defaultLayoutId)?.id ?? layouts[0]?.id ?? '',
  );

  const active =
    previews.find(p => p.themeId === themeId && p.layoutId === layoutId) ?? previews[0];

  return (
    <div>
      <AxisRow title="Theme" options={themes} activeId={themeId} onSelect={setThemeId} />
      <AxisRow title="Layout" options={layouts} activeId={layoutId} onSelect={setLayoutId} />
      <iframe
        srcDoc={active?.html ?? ''}
        title={`Digest preview — ${active?.themeLabel ?? ''} / ${active?.layoutLabel ?? ''}`}
        className="block h-[820px] w-full rounded-b-[10px] bg-white"
      />
    </div>
  );
}
