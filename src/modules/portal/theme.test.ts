import { describe, it, expect } from 'vitest';
import { resolvePortalTheme, portalThemeCssVars } from './theme';

describe('resolvePortalTheme', () => {
  it('inherits the newsletter theme + overrides when portal.appearance is unset', () => {
    const theme = resolvePortalTheme({ theme: 'swiss', appearance: { theme_overrides: { colorScheme: 'dark' } } });
    expect(theme.id).toBe('swiss');
    expect(theme.colorScheme).toBe('dark');
  });

  it('inherits the plain newsletter theme when appearance is unset', () => {
    const theme = resolvePortalTheme({ theme: 'dark-luxury' });
    expect(theme.id).toBe('dark-luxury');
  });

  it('uses portal.appearance.theme + overrides when set, ignoring the newsletter theme', () => {
    const theme = resolvePortalTheme(
      { theme: 'swiss' },
      { theme: 'editorial', theme_overrides: { palette: { accent: '#123456' } } },
    );
    expect(theme.id).toBe('editorial');
    expect(theme.palette.accent).toBe('#123456');
  });

  it('falls back to the default theme id when portal.appearance has no theme id but is set', () => {
    const theme = resolvePortalTheme({ theme: 'swiss' }, { theme_overrides: { colorScheme: 'dark' } });
    expect(theme.id).toBe('editorial');
    expect(theme.colorScheme).toBe('dark');
  });
});

describe('portalThemeCssVars', () => {
  it('maps theme fields to --portal-* CSS custom properties', () => {
    const theme = resolvePortalTheme({ theme: 'editorial' });
    const vars = portalThemeCssVars(theme);
    expect(vars['--portal-accent']).toBe(theme.palette.accent);
    expect(vars['--portal-font-body']).toBe(theme.fonts.body);
    expect(vars['--portal-radius']).toBe(`${theme.layout.radius}px`);
  });
});
