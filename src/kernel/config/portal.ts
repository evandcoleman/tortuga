import type { NewsletterConfig, PortalConfig } from './schema';

export interface ResolvedPortalLinks {
  plexUrl: string;
  requestUrl?: string;
  requestLabel?: string;
  statusUrl?: string;
}

/**
 * The portal config as resolved for rendering: `links.request_url`/`request_label`
 * fall back to the newsletter's `extras` block when unset, and `plex_url` always has
 * a default (enforced by `PortalConfigSchema`). Section-keyed DB override vs. YAML
 * resolution happens upstream (see `getAppContext`); this only applies link fallbacks.
 */
export interface ResolvedPortalConfig extends Omit<PortalConfig, 'links'> {
  links: ResolvedPortalLinks;
}

export function resolvePortalConfig(
  portal: PortalConfig,
  extras?: NewsletterConfig['extras'],
): ResolvedPortalConfig {
  return {
    ...portal,
    links: {
      plexUrl: portal.links.plex_url,
      requestUrl: portal.links.request_url ?? extras?.request_url,
      requestLabel: portal.links.request_label ?? extras?.request_label,
      statusUrl: portal.links.status_url,
    },
  };
}
