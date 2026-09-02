import type { ResolvedPortalConfig } from '@/kernel/config/portal';

export interface PortalHomeButton {
  label: string;
  /** A page-relative slug (e.g. `getting-started`) for internal buttons, or an absolute URL for external ones. */
  href: string;
  external: boolean;
  /** Short (~140 char) index-row description shown under the label. */
  description?: string;
}

/**
 * Home-grid buttons in spec order. Each is included only when its target is
 * enabled/configured. Custom entries (link or page) are appended, in list
 * order, after the built-ins.
 */
export function buildHomeButtons(portal: ResolvedPortalConfig, serverName: string): PortalHomeButton[] {
  const buttons: PortalHomeButton[] = [];

  if (portal.pages.getting_started.enabled) {
    buttons.push({
      label: 'Getting started',
      href: 'getting-started',
      external: false,
      description: `Accept the invite, install an app, pick ${serverName}, press play.`,
    });
  }
  if (portal.pages.rules.enabled) {
    buttons.push({
      label: 'House rules',
      href: 'rules',
      external: false,
      description: "Short, and mostly about not sharing your login.",
    });
  }
  buttons.push({
    label: 'Open Plex',
    href: portal.links.plexUrl,
    external: true,
    description: 'Watch in the browser at app.plex.tv.',
  });
  if (portal.links.requestUrl) {
    buttons.push({
      label: 'Make a request',
      href: portal.links.requestUrl,
      external: true,
      description: 'Missing a movie or a show? Ask for it.',
    });
  }
  if (portal.links.statusUrl) {
    buttons.push({
      label: 'Server status',
      href: portal.links.statusUrl,
      external: true,
      description: 'Check here first if nothing will play.',
    });
  }
  if (portal.pages.report_issue.enabled) {
    buttons.push({
      label: 'Report an issue',
      href: 'report-issue',
      external: false,
      description: "Wrong language, missing episodes, won't play.",
    });
  }

  for (const entry of portal.custom) {
    if (entry.type === 'link') {
      buttons.push({ label: entry.label, href: entry.url, external: true, description: entry.description });
    } else {
      buttons.push({ label: entry.label, href: entry.slug, external: false, description: entry.description });
    }
  }

  return buttons;
}
