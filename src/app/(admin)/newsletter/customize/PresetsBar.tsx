'use client';

import { useRef } from 'react';
import { PRESET_OPTIONS, PRESETS } from '@/modules/newsletter/appearance/presets';
import type { Appearance } from '@/modules/newsletter/appearance/schema';

interface PresetsBarProps {
  currentAppearance: Appearance;
  currentTheme: string;
  currentLayout: string;
  onApplyPreset: (presetId: string) => void;
  onImport: (json: string) => void;
}

export function PresetsBar({
  currentAppearance,
  currentTheme,
  currentLayout,
  onApplyPreset,
  onImport,
}: PresetsBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const payload = { appearance: currentAppearance, theme: currentTheme, layout: currentLayout };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter-appearance.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        onImport(text);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        Presets
      </span>

      {PRESET_OPTIONS.map(opt => {
        const preset = PRESETS[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            title={preset?.description}
            onClick={() => onApplyPreset(opt.value)}
            className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-muted hover:bg-surface hover:text-fg transition-colors"
          >
            {opt.label}
          </button>
        );
      })}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-muted hover:bg-surface hover:text-fg transition-colors"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-muted hover:bg-surface hover:text-fg transition-colors"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Import appearance JSON file"
        />
      </div>
    </div>
  );
}
