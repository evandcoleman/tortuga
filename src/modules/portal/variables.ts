import type { NewsletterConfig } from '@/kernel/config/schema';
import type { ResolvedPortalConfig, ResolvedPortalLinks } from '@/kernel/config/portal';

/** The `{{...}}` variables available to portal page markdown, per the spec. */
export interface PortalVariables {
  serverName: string;
  requestUrl?: string;
  requestLabel?: string;
  statusUrl?: string;
  plexUrl: string;
}

/**
 * `{{server_name}}` mirrors the recipient-email templates: it comes from the
 * newsletter's `from.name`, the one place the app already treats as "the
 * server's public name" (see `sendWelcomeEmail`).
 */
export function getPortalVariables(
  portal: ResolvedPortalConfig,
  newsletter: Pick<NewsletterConfig, 'from'>,
): PortalVariables {
  return getPortalVariablesFromLinks(portal.links, newsletter.from.name);
}

/**
 * Same as `getPortalVariables`, but takes already-resolved links directly
 * instead of a full `ResolvedPortalConfig` — used by `resolvePortalConfig`
 * itself, which needs these variables to substitute tokens into entries/copy
 * before the rest of the resolved config exists.
 */
export function getPortalVariablesFromLinks(links: ResolvedPortalLinks, serverName: string): PortalVariables {
  return {
    serverName,
    // The built-in report-issue copy links `[{{request_label}}]({{request_url}})`;
    // fall back to something that renders sanely (rather than a literal,
    // un-substituted `{{request_url}}` in the href) when the admin hasn't
    // configured a request service yet. `portal.links.*` itself stays
    // whatever was resolved — this fallback is a rendering-only concern.
    requestUrl: links.requestUrl ?? '#',
    requestLabel: links.requestLabel ?? 'the request service',
    statusUrl: links.statusUrl,
    plexUrl: links.plexUrl,
  };
}

/** Maps `PortalVariables` to the `{{token}}` names used in portal markdown. */
export function toPortalTokens(vars: PortalVariables): Record<string, string | undefined> {
  return {
    server_name: vars.serverName,
    request_url: vars.requestUrl,
    request_label: vars.requestLabel,
    status_url: vars.statusUrl,
    plex_url: vars.plexUrl,
  };
}
