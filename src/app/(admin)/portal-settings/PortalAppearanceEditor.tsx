'use client';

import type { PortalAppearance } from '@/kernel/config/schema';
import { THEME_OPTIONS, DEFAULT_THEME_ID } from '@/modules/newsletter/templates/themes';
import { ThemeOverridesEditor } from '../newsletter/customize/ThemeOverridesEditor';

interface PortalAppearanceEditorProps {
  value: PortalAppearance | undefined;
  onChange: (next: PortalAppearance | undefined) => void;
}

const selectClass =
  'w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[13.5px] text-fg outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30';

/**
 * `portal.appearance` is optional: unset means "inherit the newsletter's
 * resolved theme" (per `resolvePortalTheme()`). Setting an explicit theme
 * materializes `{ theme, theme_overrides }`; reusing `ThemeOverridesEditor`
 * from the newsletter customize page since the override shape is identical
 * (`ThemeOverridesSchema`) even though the portal has its own web design.
 */
export function PortalAppearanceEditor({ value, onChange }: PortalAppearanceEditorProps) {
  const inherits = value === undefined;

  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-2.5 py-1">
        <input
          className="mt-0.5 h-4 w-4 rounded border-line bg-canvas accent"
          type="checkbox"
          checked={inherits}
          onChange={e => onChange(e.target.checked ? undefined : { theme: DEFAULT_THEME_ID, theme_overrides: {} })}
        />
        <span>
          <span className="block text-[13.5px] text-fg">Inherit from newsletter appearance</span>
          <span className="mt-0.5 block text-[11.5px] text-muted">
            Off lets you pick a separate theme and overrides just for the portal.
          </span>
        </span>
      </label>

      {!inherits ? (
        <div className="grid gap-3 rounded-lg border border-line p-3">
          <div className="grid gap-1.5">
            <label htmlFor="portal-theme" className="text-[12.5px] font-medium text-fg">
              Theme
            </label>
            <select
              id="portal-theme"
              value={value.theme ?? DEFAULT_THEME_ID}
              onChange={e => onChange({ ...value, theme: e.target.value })}
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
            <span className="text-[12.5px] font-medium text-fg">Theme overrides</span>
            <ThemeOverridesEditor
              value={value.theme_overrides ?? {}}
              onChange={theme_overrides => onChange({ ...value, theme_overrides })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
