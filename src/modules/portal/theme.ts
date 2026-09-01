import type { NewsletterConfig, PortalAppearance } from '@/kernel/config/schema';
import { resolveThemeWithOverrides, type Theme } from '@/modules/newsletter/templates/themes';

/**
 * `portal.appearance` if set (a preset theme id plus its own overrides),
 * else the newsletter's resolved theme (`newsletter.theme` +
 * `newsletter.appearance.theme_overrides`). Per spec: "Theming".
 */
export function resolvePortalTheme(
  newsletter: Pick<NewsletterConfig, 'theme' | 'appearance'>,
  portalAppearance?: PortalAppearance,
): Theme {
  if (portalAppearance) {
    return resolveThemeWithOverrides(portalAppearance.theme, portalAppearance.theme_overrides);
  }
  return resolveThemeWithOverrides(newsletter.theme, newsletter.appearance?.theme_overrides);
}

/** CSS custom properties fed to the portal layout's chrome. */
export function portalThemeCssVars(theme: Theme): Record<string, string> {
  return {
    '--portal-paper': theme.palette.paper,
    '--portal-ink': theme.palette.ink,
    '--portal-muted': theme.palette.muted,
    '--portal-rule': theme.palette.rule,
    '--portal-hairline': theme.palette.hairline,
    '--portal-accent': theme.palette.accent,
    '--portal-on-accent': theme.palette.onAccent,
    '--portal-card-bg': theme.palette.cardBg,
    '--portal-chip-bg': theme.palette.chipBg,
    '--portal-chip-fg': theme.palette.chipFg,
    '--portal-font-heading': theme.fonts.heading,
    '--portal-font-body': theme.fonts.body,
    '--portal-radius': `${theme.layout.radius}px`,
  };
}
