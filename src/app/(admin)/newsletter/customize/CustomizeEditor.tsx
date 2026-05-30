'use client';

import { useState } from 'react';
import { PRESETS } from '@/modules/newsletter/appearance/presets';
import { resolveBlocks } from '@/modules/newsletter/appearance/resolve';
import {
  FooterSchema,
  HeaderSchema,
  ItemDisplaySchema,
  type Appearance,
  type FooterConfig,
  type HeaderConfig,
  type ItemDisplay,
  type LibraryRule,
  type ThemeOverrides,
} from '@/modules/newsletter/appearance/schema';
import { THEME_OPTIONS } from '@/modules/newsletter/templates/themes';
import { LAYOUT_OPTIONS } from '@/modules/newsletter/templates/layouts';
import { Button } from '../../_components/ui';
import { importAppearance, saveAppearance } from './actions';
import { BlockEditor, type BlockState } from './BlockEditor';
import { LibraryEditor } from './LibraryEditor';
import { ThemeOverridesEditor } from './ThemeOverridesEditor';
import { FooterEditor, HeaderEditor, ItemDisplayEditor } from './ItemDisplayEditor';
import { PresetsBar } from './PresetsBar';
import { LivePreview } from './LivePreview';

interface CustomizeEditorProps {
  appearance: Appearance;
  theme: string;
  layout: string;
  knownLibraries: string[];
}

interface WorkingState {
  appearance: Appearance;
  theme: string;
  layout: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-fg outline-none transition focus:border-line-strong focus:ring-2 focus:ring-line-strong/40';

// Defaulted sub-configs have required fields in the schema's output type, so
// editors need a fully-populated object even when nothing has been set yet.
const DEFAULT_ITEM_DISPLAY: ItemDisplay = ItemDisplaySchema.parse({});
const DEFAULT_HEADER: HeaderConfig = HeaderSchema.parse({});
const DEFAULT_FOOTER: FooterConfig = FooterSchema.parse({});

// Always expand the stored block list to the full six-row set so every block
// row renders and the saved value remains a valid AppearanceSchema array.
function normalize(appearance: Appearance): Appearance {
  return { ...appearance, blocks: resolveBlocks(appearance.blocks) };
}

export function CustomizeEditor({ appearance, theme, layout, knownLibraries }: CustomizeEditorProps) {
  const [working, setWorking] = useState<WorkingState>(() => ({
    appearance: normalize(appearance),
    theme,
    layout,
  }));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isSaving, setIsSaving] = useState(false);

  function patchAppearance(patch: Partial<Appearance>) {
    setWorking(prev => ({ ...prev, appearance: { ...prev.appearance, ...patch } }));
  }

  function handleBlocks(blocks: BlockState[]) {
    patchAppearance({ blocks });
  }
  function handleLibraries(libraries: LibraryRule[]) {
    patchAppearance({ libraries });
  }
  function handleThemeOverrides(theme_overrides: ThemeOverrides) {
    patchAppearance({ theme_overrides });
  }
  function handleItemDisplay(item_display: ItemDisplay) {
    patchAppearance({ item_display });
  }
  function handleHeader(header: HeaderConfig) {
    patchAppearance({ header });
  }
  function handleFooter(footer: FooterConfig) {
    patchAppearance({ footer });
  }

  function handleApplyPreset(presetId: string) {
    const preset = PRESETS[presetId];
    if (!preset) return;
    setWorking(prev => ({
      appearance: normalize(preset.appearance),
      theme: preset.theme ?? prev.theme,
      layout: preset.layout ?? prev.layout,
    }));
    setStatus({ kind: 'idle' });
  }

  async function handleImport(json: string) {
    setStatus({ kind: 'idle' });
    const result = await importAppearance(json);
    if (!result.success) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    setWorking(prev => ({
      appearance: normalize(result.appearance),
      theme: result.theme ?? prev.theme,
      layout: result.layout ?? prev.layout,
    }));
    setStatus({ kind: 'success', message: 'Imported configuration.' });
  }

  async function handleSave() {
    setIsSaving(true);
    setStatus({ kind: 'idle' });
    try {
      const result = await saveAppearance(working.appearance, working.theme, working.layout);
      if (result.success) {
        setStatus({ kind: 'success', message: 'Saved as default.' });
      } else {
        setStatus({ kind: 'error', message: result.error ?? 'Failed to save.' });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Theme &amp; layout</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="customize-theme" className="text-[12.5px] font-medium text-fg">
                Theme
              </label>
              <select
                id="customize-theme"
                value={working.theme}
                onChange={e => setWorking(prev => ({ ...prev, theme: e.target.value }))}
                className={selectClass}
              >
                {THEME_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="customize-layout" className="text-[12.5px] font-medium text-fg">
                Layout
              </label>
              <select
                id="customize-layout"
                value={working.layout}
                onChange={e => setWorking(prev => ({ ...prev, layout: e.target.value }))}
                className={selectClass}
              >
                {LAYOUT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Presets</h2>
          <PresetsBar
            currentAppearance={working.appearance}
            currentTheme={working.theme}
            currentLayout={working.layout}
            onApplyPreset={handleApplyPreset}
            onImport={handleImport}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Blocks</h2>
          <p className="text-[12px] text-muted">Drag to reorder, toggle visibility.</p>
          <BlockEditor blocks={working.appearance.blocks ?? []} onChange={handleBlocks} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Library rules</h2>
          <LibraryEditor
            rules={working.appearance.libraries ?? []}
            knownLibraries={knownLibraries}
            onChange={handleLibraries}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Theme overrides</h2>
          <ThemeOverridesEditor
            value={working.appearance.theme_overrides ?? {}}
            onChange={handleThemeOverrides}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Header</h2>
          <HeaderEditor value={working.appearance.header ?? DEFAULT_HEADER} onChange={handleHeader} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Item display</h2>
          <ItemDisplayEditor value={working.appearance.item_display ?? DEFAULT_ITEM_DISPLAY} onChange={handleItemDisplay} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Footer</h2>
          <FooterEditor value={working.appearance.footer ?? DEFAULT_FOOTER} onChange={handleFooter} />
        </section>

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <Button variant="primary" onClick={handleSave} disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? 'Saving…' : 'Save as default'}
          </Button>
          {status.kind === 'success' ? (
            <span className="text-[13px] text-success">{status.message}</span>
          ) : null}
          {status.kind === 'error' ? (
            <span className="text-[13px] text-danger">{status.message}</span>
          ) : null}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <LivePreview
          appearance={working.appearance}
          theme={working.theme}
          layout={working.layout}
        />
      </div>
    </div>
  );
}
