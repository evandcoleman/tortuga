'use client';

import { useState } from 'react';
import type { ThemeOverrides } from '@/modules/newsletter/appearance/schema';
import { isSafeColor, isSafeFontStack, isSafeLetterSpacing } from '@/modules/newsletter/appearance/sanitize';

interface ThemeOverridesEditorProps {
  value: ThemeOverrides;
  onChange: (next: ThemeOverrides) => void;
}

const PALETTE_FIELDS: Array<{ key: keyof NonNullable<ThemeOverrides['palette']>; label: string }> = [
  { key: 'paper', label: 'Paper (background)' },
  { key: 'ink', label: 'Ink (body text)' },
  { key: 'muted', label: 'Muted text' },
  { key: 'rule', label: 'Rule / divider' },
  { key: 'hairline', label: 'Hairline border' },
  { key: 'accent', label: 'Accent' },
  { key: 'onAccent', label: 'On-accent text' },
  { key: 'cardBg', label: 'Card background' },
  { key: 'chipBg', label: 'Chip background' },
  { key: 'chipFg', label: 'Chip text' },
];

export function ThemeOverridesEditor({ value, onChange }: ThemeOverridesEditorProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [fontsOpen, setFontsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  function setPalette(key: keyof NonNullable<ThemeOverrides['palette']>, val: string) {
    const next = val ? { ...value.palette, [key]: val } : omit(value.palette ?? {}, key);
    onChange({ ...value, palette: Object.keys(next).length > 0 ? next : undefined });
  }

  function setFont(key: 'heading' | 'body', val: string) {
    const nextFonts = val ? { ...value.fonts, [key]: val } : omit(value.fonts ?? {}, key);
    onChange({ ...value, fonts: Object.keys(nextFonts).length > 0 ? nextFonts : undefined });
  }

  function setLayout<K extends keyof NonNullable<ThemeOverrides['layout']>>(
    key: K,
    val: NonNullable<ThemeOverrides['layout']>[K] | undefined,
  ) {
    const nextLayout = val !== undefined
      ? { ...value.layout, [key]: val }
      : omit(value.layout ?? {}, key as string);
    onChange({ ...value, layout: Object.keys(nextLayout).length > 0 ? nextLayout : undefined });
  }

  return (
    <div className="space-y-2">
      {/* Palette */}
      <CollapsibleSection
        label="Colors"
        open={paletteOpen}
        onToggle={() => setPaletteOpen(o => !o)}
      >
        <div className="space-y-2">
          {PALETTE_FIELDS.map(({ key, label }) => {
            const raw = value.palette?.[key] ?? '';
            const isHex = /^#[0-9a-fA-F]{3,8}$/.test(raw);
            const invalid = raw !== '' && !isSafeColor(raw);
            return (
              <ColorRow
                key={key}
                label={label}
                value={raw}
                isHex={isHex}
                invalid={invalid}
                onChange={val => setPalette(key, val)}
              />
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Fonts */}
      <CollapsibleSection
        label="Fonts"
        open={fontsOpen}
        onToggle={() => setFontsOpen(o => !o)}
      >
        <div className="space-y-2">
          {(['heading', 'body'] as const).map(key => {
            const raw = value.fonts?.[key] ?? '';
            const invalid = raw !== '' && !isSafeFontStack(raw);
            return (
              <div key={key}>
                <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
                  {key === 'heading' ? 'Heading font' : 'Body font'}
                </label>
                <input
                  type="text"
                  value={raw}
                  placeholder='e.g. "Inter", sans-serif'
                  onChange={e => setFont(key, e.target.value)}
                  className={fieldClass(invalid)}
                />
                {invalid && <p className="mt-0.5 text-[11px] text-danger">Invalid font stack</p>}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Layout knobs */}
      <CollapsibleSection
        label="Layout"
        open={layoutOpen}
        onToggle={() => setLayoutOpen(o => !o)}
      >
        <div className="space-y-2">
          <NumberField
            label="Corner radius (0–40)"
            value={value.layout?.radius}
            min={0}
            max={40}
            onChange={v => setLayout('radius', v)}
          />
          <NumberField
            label="Card border width (0–8)"
            value={value.layout?.cardBorderWidth}
            min={0}
            max={8}
            onChange={v => setLayout('cardBorderWidth', v)}
          />
          <NumberField
            label="Rule width (0–8)"
            value={value.layout?.ruleWidth}
            min={0}
            max={8}
            onChange={v => setLayout('ruleWidth', v)}
          />
          <NumberField
            label="Heading weight (100–900)"
            value={value.layout?.headingWeight}
            min={100}
            max={900}
            step={100}
            onChange={v => setLayout('headingWeight', v)}
          />
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
              Heading letter-spacing (em/rem/px)
            </label>
            <input
              type="text"
              value={value.layout?.headingLetterSpacing ?? ''}
              placeholder="e.g. -0.02em"
              onChange={e => {
                const v = e.target.value;
                setLayout('headingLetterSpacing', v || undefined);
              }}
              className={fieldClass(
                !!value.layout?.headingLetterSpacing &&
                  !isSafeLetterSpacing(value.layout.headingLetterSpacing),
              )}
            />
            {value.layout?.headingLetterSpacing &&
              !isSafeLetterSpacing(value.layout.headingLetterSpacing) && (
                <p className="mt-0.5 text-[11px] text-danger">Use em, rem, or px</p>
              )}
          </div>
          <NumberField
            label="Eyebrow letter-spacing (0–12)"
            value={value.layout?.eyebrowLetterSpacing}
            min={0}
            max={12}
            step={0.01}
            onChange={v => setLayout('eyebrowLetterSpacing', v)}
          />
          <div>
            <label className="flex items-center gap-2 text-[12.5px] text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={value.layout?.introItalic ?? false}
                onChange={e => setLayout('introItalic', e.target.checked || undefined)}
                className="accent"
              />
              Italic intro text
            </label>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fieldClass(invalid: boolean) {
  return [
    'w-full rounded border bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1',
    invalid ? 'border-danger focus:ring-danger' : 'border-line focus:ring-accent',
  ].join(' ');
}

function omit<T extends object>(obj: T, key: keyof T | string): Partial<T> {
  const { [key as keyof T]: _removed, ...rest } = obj;
  return rest as Partial<T>;
}

function CollapsibleSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-[12.5px] font-medium text-fg hover:bg-surface"
      >
        {label}
        <span className="text-faint">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="border-t border-line px-3 py-3">{children}</div>}
    </div>
  );
}

function ColorRow({
  label,
  value,
  isHex,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  isHex: boolean;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          placeholder="Inherit"
          onChange={e => onChange(e.target.value)}
          className={fieldClass(invalid)}
        />
        {isHex && (
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            aria-label={`${label} color picker`}
            className="h-8 w-10 cursor-pointer rounded border border-line p-0.5"
          />
        )}
      </div>
      {invalid && <p className="mt-0.5 text-[11px] text-danger">Invalid color value</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-faint mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder="Default"
        onChange={e => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
          } else {
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(n);
          }
        }}
        className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-fg placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
