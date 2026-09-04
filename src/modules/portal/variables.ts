import type { NewsletterConfig } from '@/kernel/config/schema';
import type { ResolvedPortalConfig, ResolvedPortalLinks } from '@/kernel/config/portal';

/** The `{{...}}` variables available to portal page markdown, per the spec. */
export interface PortalVariables {
  serverName: string;
  requestUrl?: string;
  requestLabel?: string;
  statusUrl?: string;
  plexUrl: string;
  reportIssueUrl?: string;
}

export interface GetPortalVariablesOptions {
  /** Request-scoped portal base path (see `getPortalBasePath`); used to build `reportIssueUrl`. */
  basePath?: string;
}

/**
 * `{{server_name}}` mirrors the recipient-email templates: it comes from the
 * newsletter's `from.name`, the one place the app already treats as "the
 * server's public name" (see `sendWelcomeEmail`).
 */
export function getPortalVariables(
  portal: ResolvedPortalConfig,
  newsletter: Pick<NewsletterConfig, 'from'>,
  opts?: GetPortalVariablesOptions,
): PortalVariables {
  const vars = getPortalVariablesFromLinks(portal.links, newsletter.from.name);
  if (opts?.basePath === undefined) return vars;

  // The report-issue page itself just sends people to the request portal, so
  // when it's disabled the rules link should still land somewhere useful
  // rather than 404ing.
  const reportIssueUrl = portal.pages.report_issue.enabled
    ? `${opts.basePath}/report-issue`
    : vars.requestUrl;

  return { ...vars, reportIssueUrl };
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
    report_issue_url: vars.reportIssueUrl,
  };
}
