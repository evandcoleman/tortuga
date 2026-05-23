import { describe, it, expect } from 'vitest';
import { THEMES, DEFAULT_THEME_ID, resolveTheme, THEME_OPTIONS } from './themes';

describe('themes', () => {
  it('resolves a known theme by id', () => {
    expect(resolveTheme('newsprint').id).toBe('newsprint');
    expect(resolveTheme('dark-luxury').colorScheme).toBe('dark');
  });

  it('falls back to the default for unknown or blank ids', () => {
    expect(resolveTheme('does-not-exist').id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme('').id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme(null).id).toBe(DEFAULT_THEME_ID);
  });

  it('every theme declares the full palette, fonts, and layout contract', () => {
    const paletteKeys = ['paper', 'ink', 'muted', 'rule', 'hairline', 'accent', 'onAccent', 'cardBg', 'chipBg', 'chipFg'];
    for (const theme of Object.values(THEMES)) {
      expect(theme.id).toBeTruthy();
      expect(theme.label).toBeTruthy();
      expect(theme.fonts.heading).toBeTruthy();
      expect(theme.fonts.body).toBeTruthy();
      for (const key of paletteKeys) {
        expect(theme.palette[key as keyof typeof theme.palette]).toMatch(/^#|rgb/);
      }
      expect(typeof theme.layout.radius).toBe('number');
    }
  });

  it('exposes selectable options for the settings UI', () => {
    expect(THEME_OPTIONS.length).toBe(Object.keys(THEMES).length);
    expect(THEME_OPTIONS.find(o => o.value === DEFAULT_THEME_ID)).toBeTruthy();
  });
});
