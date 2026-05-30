import { describe, it, expect } from 'vitest';
import { importAppearance } from './actions';

describe('importAppearance', () => {
  it('parses a valid appearance JSON', async () => {
    const r = await importAppearance(
      JSON.stringify({
        appearance: { item_display: { show_poster: false } },
        theme: 'swiss',
        layout: 'compact',
      }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.theme).toBe('swiss');
      expect(r.appearance.item_display?.show_poster).toBe(false);
    }
  });

  it('rejects malformed JSON', async () => {
    const r = await importAppearance('{ not json');
    expect(r.success).toBe(false);
  });

  it('rejects an unsafe color in imported JSON', async () => {
    const r = await importAppearance(
      JSON.stringify({
        appearance: { theme_overrides: { palette: { accent: 'red;}' } } },
      }),
    );
    expect(r.success).toBe(false);
  });
});
