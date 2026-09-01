import type { ResolvedPortalConfig } from '@/kernel/config/portal';

export interface PortalHomeButton {
  label: string;
  /** A page-relative slug (e.g. `getting-started`) for internal buttons, or an absolute URL for external ones. */
  href: string;
  external: boolean;
}

/**
 * Home-grid buttons in spec order. Each is included only when its target is
 * enabled/configured. Custom entries (link or page) are appended, in list
 * order, after the built-ins.
 */
export function buildHomeButtons(portal: ResolvedPortalConfig): PortalHomeButton[] {
  const buttons: PortalHomeButton[] = [];

  if (portal.pages.getting_started.enabled) {
    buttons.push({ label: 'Getting Started', href: 'getting-started', external: false });
  }
  if (portal.pages.rules.enabled) {
    buttons.push({ label: 'Rules', href: 'rules', external: false });
  }
  buttons.push({ label: 'Go to Plex', href: portal.links.plexUrl, external: true });
  if (portal.links.requestUrl) {
    buttons.push({ label: 'Make a Request', href: portal.links.requestUrl, external: true });
  }
  if (portal.links.statusUrl) {
    buttons.push({ label: 'Server Status', href: portal.links.statusUrl, external: true });
  }
  if (portal.pages.report_issue.enabled) {
    buttons.push({ label: 'Report an Issue', href: 'report-issue', external: false });
  }

  for (const entry of portal.custom) {
    if (entry.type === 'link') {
      buttons.push({ label: entry.label, href: entry.url, external: true });
    } else {
      buttons.push({ label: entry.label, href: entry.slug, external: false });
    }
  }

  return buttons;
}
