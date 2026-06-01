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
  'marquee-spotlight': {
    id: 'marquee-spotlight',
    label: 'Marquee Spotlight',
    description:
      "The editor's-pick hero treatment under a dark cinema palette with condensed marquee headings and a crimson accent. Dramatic, focused, the one big thing tonight.",
    theme: 'cinema-noir',
    layout: 'spotlight',
    appearance: {
      item_display: { show_overview: true, show_rating: true, poster_scale: 'md', show_poster: true },
    },
  },
  'recently-added': {
    id: 'recently-added',
    label: 'Recently Added',
    description:
      'A chronological timeline of new arrivals hung off a dated left rail in a cool midnight-navy palette with steel-blue accents. Reads like a changelog of the library.',
    theme: 'nocturne',
    layout: 'timeline',
    appearance: {
      item_display: { show_poster: true, show_overview: true, poster_scale: 'sm', show_rating: true },
    },
  },
  'atelier-spread': {
    id: 'atelier-spread',
    label: 'Atelier Spread',
    description:
      'A couture lookbook editorial: alternating poster/text spreads on stark gallery white with a dusty-blush accent and tight sans headings. Generous air, hairline rules, no card chrome.',
    theme: 'atelier',
    layout: 'ledger',
    appearance: {
      item_display: { poster_scale: 'lg', show_overview: true, show_rating: false, show_poster: true },
    },
  },
  'villa-ledger': {
    id: 'villa-ledger',
    label: 'Villa Ledger',
    description:
      'Warm stone-and-terracotta editorial spreads: alternating poster/text rows on sun-warmed limestone with espresso serif headings and italic intros. Earthy and tactile.',
    theme: 'travertine',
    layout: 'ledger',
    appearance: {
      item_display: { poster_scale: 'md', show_overview: true, show_rating: true, show_poster: true },
    },
  },
  'the-index': {
    id: 'the-index',
    label: 'The Index',
    description:
      'A poster-light numbered table of contents of everything added, on stark gallery white with charcoal headings and a single blush accent. A spare, high-contrast manifest.',
    theme: 'atelier',
    layout: 'index-toc',
    appearance: {
      item_display: {
        show_poster: false,
        show_overview: true,
        overview_max_chars: 120,
        show_rating: true,
        poster_scale: 'md',
      },
    },
  },
  'noir-index': {
    id: 'noir-index',
    label: 'Noir Index',
    description:
      'A dark numbered index of new arrivals: crimson-on-charcoal contents rows with condensed marquee numbers. Authoritative and cinematic.',
    theme: 'cinema-noir',
    layout: 'index-toc',
    appearance: {
      item_display: { show_poster: false, show_overview: false, show_rating: true, poster_scale: 'md' },
    },
  },
};

export const PRESET_OPTIONS = Object.values(PRESETS).map(p => ({ value: p.id, label: p.label }));
