import { z } from 'zod';
import { isSafeColor, isSafeFontStack, isSafeLetterSpacing } from './sanitize';

export const DEFAULT_BLOCK_ORDER = ['header', 'intro', 'libraries', 'freeform', 'actions', 'footer'] as const;
export type BlockId = (typeof DEFAULT_BLOCK_ORDER)[number];

const safeColor = z.string().refine(isSafeColor, { message: 'unsafe or invalid color' });
const safeFont = z.string().refine(isSafeFontStack, { message: 'unsafe or invalid font stack' });
const safeSpacing = z.string().refine(isSafeLetterSpacing, { message: 'invalid letter-spacing (use em/rem/px)' });

export const ThemeOverridesSchema = z
  .object({
    colorScheme: z.enum(['light', 'dark']).optional(),
    fonts: z.object({ heading: safeFont, body: safeFont }).partial().strict().optional(),
    palette: z
      .object({
        paper: safeColor, ink: safeColor, muted: safeColor, rule: safeColor, hairline: safeColor,
        accent: safeColor, onAccent: safeColor, cardBg: safeColor, chipBg: safeColor, chipFg: safeColor,
      })
      .partial().strict().optional(),
    layout: z
      .object({
        radius: z.number().min(0).max(40),
        cardBorderWidth: z.number().min(0).max(8),
        ruleWidth: z.number().min(0).max(8),
        headingWeight: z.number().int().min(100).max(900),
        headingLetterSpacing: safeSpacing,
        eyebrowLetterSpacing: z.number().min(0).max(12),
        introItalic: z.boolean(),
      })
      .partial().strict().optional(),
  })
  .strict();
export type ThemeOverrides = z.infer<typeof ThemeOverridesSchema>;

export const BlockSchema = z.object({ id: z.enum(DEFAULT_BLOCK_ORDER), enabled: z.boolean() }).strict();

export const LibraryRuleSchema = z
  .object({
    name: z.string().min(1).max(120),
    enabled: z.boolean().default(true),
    title: z.string().min(1).max(120).optional(),
    max_items: z.number().int().positive().max(100).optional(),
    layout: z.string().min(1).max(40).optional(),
  })
  .strict();
export type LibraryRule = z.infer<typeof LibraryRuleSchema>;

export const ItemDisplaySchema = z
  .object({
    show_poster: z.boolean().default(true),
    show_rating: z.boolean().default(true),
    show_overview: z.boolean().default(true),
    overview_max_chars: z.number().int().min(0).max(1000).optional(),
    poster_scale: z.enum(['sm', 'md', 'lg']).default('md'),
  })
  .strict();
export type ItemDisplay = z.infer<typeof ItemDisplaySchema>;

export const HeaderSchema = z
  .object({
    eyebrow: z.string().max(120).optional(),
    title: z.string().max(160).optional(),
    show_count: z.boolean().default(true),
    show_date_range: z.boolean().default(true),
  })
  .strict();
export type HeaderConfig = z.infer<typeof HeaderSchema>;

export const FooterSchema = z
  .object({ text: z.string().max(500).optional(), show_app_label: z.boolean().default(true) })
  .strict();
export type FooterConfig = z.infer<typeof FooterSchema>;

export const AppearanceSchema = z
  .object({
    theme_overrides: ThemeOverridesSchema.optional(),
    blocks: z
      .array(BlockSchema)
      .refine(arr => new Set(arr.map(b => b.id)).size === arr.length, { message: 'duplicate block ids' })
      .optional(),
    libraries: z.array(LibraryRuleSchema).max(100).optional(),
    item_display: ItemDisplaySchema.optional(),
    header: HeaderSchema.optional(),
    footer: FooterSchema.optional(),
  })
  .strict();
export type Appearance = z.infer<typeof AppearanceSchema>;
