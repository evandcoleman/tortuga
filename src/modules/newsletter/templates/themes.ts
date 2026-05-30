// Newsletter email themes. Each theme is a palette + font pairing + a few
// layout knobs. The registry is the single source of truth: add a Theme here
// and it shows up everywhere (renderer, settings dropdown) automatically.
// Unknown/blank theme ids resolve to the default, so config never hard-fails.

export interface ThemePalette {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  hairline: string;
  accent: string;
  onAccent: string;
  cardBg: string;
  chipBg: string;
  chipFg: string;
}

export interface ThemeLayout {
  radius: number;
  cardBorderWidth: number;
  cardShadow?: string;
  ruleWidth: number;
  headingWeight: number;
  headingLetterSpacing: string;
  eyebrowLetterSpacing: number;
  introItalic: boolean;
}

export interface Theme {
  id: string;
  label: string;
  colorScheme: 'light' | 'dark';
  fonts: { heading: string; body: string };
  palette: ThemePalette;
  layout: ThemeLayout;
}

const SERIF =
  '"Iowan Old Style","Apple Garamond","Baskerville","Times New Roman","Droid Serif","Times","Source Serif Pro",serif';
const SANS = '"Inter","Helvetica Neue","Helvetica","Arial",sans-serif';
const NARROW = '"Arial Narrow","Helvetica Neue Condensed","Helvetica Neue",Helvetica,Arial,sans-serif';
const NEWS_BODY = 'Georgia,"Times New Roman",Times,serif';

export const editorialTheme: Theme = {
  id: 'editorial',
  label: 'Editorial',
  colorScheme: 'light',
  fonts: { heading: SERIF, body: SANS },
  palette: {
    paper: '#faf8f4',
    ink: '#161410',
    muted: '#5d564b',
    rule: '#e3ddd0',
    hairline: '#ece6d8',
    accent: '#b07a1e',
    onAccent: '#faf8f4',
    cardBg: '#ffffff',
    chipBg: '#f3eedf',
    chipFg: '#7a5d24',
  },
  layout: {
    radius: 6,
    cardBorderWidth: 1,
    ruleWidth: 1,
    headingWeight: 600,
    headingLetterSpacing: '-0.02em',
    eyebrowLetterSpacing: 4,
    introItalic: true,
  },
};

export const swissTheme: Theme = {
  id: 'swiss',
  label: 'Swiss / Minimal',
  colorScheme: 'light',
  fonts: { heading: SANS, body: SANS },
  palette: {
    paper: '#ffffff',
    ink: '#111111',
    muted: '#6b7280',
    rule: '#111111',
    hairline: '#e5e7eb',
    accent: '#e3242b',
    onAccent: '#ffffff',
    cardBg: '#ffffff',
    chipBg: '#f3f4f6',
    chipFg: '#111111',
  },
  layout: {
    radius: 0,
    cardBorderWidth: 1,
    ruleWidth: 2,
    headingWeight: 700,
    headingLetterSpacing: '-0.02em',
    eyebrowLetterSpacing: 2,
    introItalic: false,
  },
};

export const darkLuxuryTheme: Theme = {
  id: 'dark-luxury',
  label: 'Dark Luxury',
  colorScheme: 'dark',
  fonts: { heading: SERIF, body: SANS },
  palette: {
    paper: '#0e0d0b',
    ink: '#f3efe6',
    muted: '#9a9384',
    rule: '#2a2722',
    hairline: '#211e19',
    accent: '#c9a24b',
    onAccent: '#0e0d0b',
    cardBg: '#16140f',
    chipBg: '#221d12',
    chipFg: '#d8b65f',
  },
  layout: {
    radius: 8,
    cardBorderWidth: 1,
    cardShadow: '0 1px 0 rgba(255,255,255,0.03)',
    ruleWidth: 1,
    headingWeight: 600,
    headingLetterSpacing: '-0.02em',
    eyebrowLetterSpacing: 4,
    introItalic: true,
  },
};

export const newsprintTheme: Theme = {
  id: 'newsprint',
  label: 'Newsprint',
  colorScheme: 'light',
  fonts: { heading: NARROW, body: NEWS_BODY },
  palette: {
    paper: '#ffffff',
    ink: '#0a0a0a',
    muted: '#444444',
    rule: '#0a0a0a',
    hairline: '#cccccc',
    accent: '#0a0a0a',
    onAccent: '#ffffff',
    cardBg: '#ffffff',
    chipBg: '#efefef',
    chipFg: '#0a0a0a',
  },
  layout: {
    radius: 0,
    cardBorderWidth: 0,
    ruleWidth: 3,
    headingWeight: 700,
    headingLetterSpacing: '-0.01em',
    eyebrowLetterSpacing: 3,
    introItalic: true,
  },
};

export const DEFAULT_THEME_ID = 'editorial';

export const THEMES: Record<string, Theme> = {
  [editorialTheme.id]: editorialTheme,
  [swissTheme.id]: swissTheme,
  [darkLuxuryTheme.id]: darkLuxuryTheme,
  [newsprintTheme.id]: newsprintTheme,
};

export function resolveTheme(id?: string | null): Theme {
  return (id ? THEMES[id] : undefined) ?? THEMES[DEFAULT_THEME_ID];
}

export const THEME_OPTIONS = Object.values(THEMES).map(t => ({ value: t.id, label: t.label }));

import type { ThemeOverrides } from '../appearance/schema';

export function resolveThemeWithOverrides(id?: string | null, overrides?: ThemeOverrides): Theme {
  const base = resolveTheme(id);
  if (!overrides) return base;
  return {
    ...base,
    colorScheme: overrides.colorScheme ?? base.colorScheme,
    fonts: { ...base.fonts, ...(overrides.fonts ?? {}) },
    palette: { ...base.palette, ...(overrides.palette ?? {}) },
    layout: { ...base.layout, ...(overrides.layout ?? {}) },
  };
}
