'use client';

import { useState } from 'react';

export interface ThemedPreview {
  id: string;
  label: string;
  html: string;
}

export function ThemeSwitcher({
  previews,
  defaultThemeId,
}: {
  previews: ThemedPreview[];
  defaultThemeId: string;
}) {
  const initial = previews.find(p => p.id === defaultThemeId)?.id ?? previews[0]?.id;
  const [activeId, setActiveId] = useState(initial);
  const active = previews.find(p => p.id === activeId) ?? previews[0];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Theme
        </span>
        {previews.map(p => {
          const isActive = p.id === active?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              aria-pressed={isActive}
              className={[
                'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                isActive
                  ? 'bg-gold text-gold-ink'
                  : 'bg-transparent text-muted hover:bg-surface hover:text-fg',
              ].join(' ')}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <iframe
        srcDoc={active?.html ?? ''}
        title={`Digest preview — ${active?.label ?? ''}`}
        className="block h-[820px] w-full rounded-b-[10px] bg-white"
      />
    </div>
  );
}
