import type { Appearance } from './schema';

export interface AppearancePreset {
  id: string;
  label: string;
  description: string;
  theme: string;
  layout: string;
  appearance: Appearance;
}

export const PRESETS: Record<string, AppearancePreset> = {
  'editorial-classic': {
    id: 'editorial-classic',
    label: 'Editorial Classic',
    description: "The default look. A clean reset baseline.",
    theme: 'editorial',
    layout: 'list',
    appearance: {},
  },
  minimalist: {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Compact rows, no overview text, small posters.',
    theme: 'swiss',
    layout: 'compact',
    appearance: {
      item_display: { show_overview: false, poster_scale: 'sm', show_poster: true, show_rating: true },
    },
  },
  'gallery-wall': {
    id: 'gallery-wall',
    label: 'Gallery Wall',
    description: 'Poster-forward grid, ratings hidden.',
    theme: 'editorial',
    layout: 'gallery',
    appearance: {
      item_display: { show_rating: false, poster_scale: 'lg', show_poster: true, show_overview: true },
    },
  },
  'dark-luxury': {
    id: 'dark-luxury',
    label: 'Dark Luxury',
    description: 'Dark palette with gold accents and serif headings.',
    theme: 'dark-luxury',
    layout: 'list',
    appearance: {
      theme_overrides: { layout: { radius: 10 } },
    },
  },
};

export const PRESET_OPTIONS = Object.values(PRESETS).map(p => ({ value: p.id, label: p.label }));
