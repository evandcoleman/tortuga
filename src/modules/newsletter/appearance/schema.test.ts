import { describe, it, expect } from 'vitest';
import { AppearanceSchema, DEFAULT_BLOCK_ORDER } from './schema';

describe('AppearanceSchema', () => {
  it('accepts an empty object (all optional)', () => {
    expect(AppearanceSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a full valid appearance', () => {
    const r = AppearanceSchema.safeParse({
      theme_overrides: { palette: { accent: '#123456' }, layout: { radius: 10 } },
      blocks: DEFAULT_BLOCK_ORDER.map(id => ({ id, enabled: true })),
      libraries: [{ name: 'Movies', enabled: true, title: 'Films', max_items: 5, layout: 'gallery' }],
      item_display: { show_poster: false, poster_scale: 'lg' },
      header: { eyebrow: 'Custom', show_count: false },
      footer: { text: 'Thanks', show_app_label: true },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unsafe override color', () => {
    const r = AppearanceSchema.safeParse({ theme_overrides: { palette: { accent: 'red;}' } } });
    expect(r.success).toBe(false);
  });

  it('rejects duplicate block ids', () => {
    const r = AppearanceSchema.safeParse({ blocks: [{ id: 'header', enabled: true }, { id: 'header', enabled: false }] });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown block id', () => {
    const r = AppearanceSchema.safeParse({ blocks: [{ id: 'sidebar', enabled: true }] });
    expect(r.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(AppearanceSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });
});
