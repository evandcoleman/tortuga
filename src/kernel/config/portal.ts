import { substituteTokens } from '@/modules/templates/substitute';
import { getPortalVariablesFromLinks, toPortalTokens } from '@/modules/portal/variables';
import {
  DEFAULT_BUILTIN_LINK_COPY,
  DEFAULT_BUILTIN_PAGE_COPY,
  DEFAULT_PAGE_COPY,
  DEFAULT_PORTAL_COPY,
  DEFAULT_PORTAL_ENTRIES,
} from '@/modules/portal/copy';
import type { NewsletterConfig, PortalConfig, PortalEntry, PortalPageConfigSchema } from './schema';
import type { z } from 'zod';

export interface ResolvedPortalLinks {
  plexUrl: string;
  requestUrl?: string;
  requestLabel?: string;
  statusUrl?: string;
}

export interface ResolvedPortalPageConfig {
  enabled: boolean;
  markdown?: string | null;
  title: string;
  eyebrow: string;
}

export interface ResolvedPortalEntry {
  kind: 'builtin_page' | 'builtin_link' | 'link' | 'page';
  /** Stable identifier: the page/link name for built-ins, the slug/url for custom rows. */
  id: string;
  label: string;
  description?: string;
  href: string;
  external: boolean;
  /** Zero-padded 1-based position among visible rows, e.g. `'01'`. */
  number: string;
}

export interface ResolvedPortalCopy {
  tagline: string;
  intro: string;
  tabTitle: string;
  tocHeading: string;
  stuckTitle: string;
  stuckBody: string;
  stuckLinkLabel: string;
  backLabel: string;
  footer: string;
  customPageEyebrow: string;
  showStuckCard: boolean;
  showFooter: boolean;
}

type RawPortalPageConfig = z.infer<typeof PortalPageConfigSchema>;

/**
 * The portal config as resolved for rendering: `links.request_url`/`request_label`
 * fall back to the newsletter's `extras` block when unset, `plex_url` always has
 * a default (enforced by `PortalConfigSchema`), the home index is fully resolved
 * (defaults applied, built-ins mapped to hrefs, hidden/unavailable rows dropped,
 * numbered), and every piece of copy (entries, page titles/eyebrows, chrome copy)
 * has had `{{token}}` substitution applied. Section-keyed DB override vs. YAML
 * resolution happens upstream (see `getAppContext`); this only applies fallbacks,
 * defaults, and substitution.
 *
 * Substitution here is plain-text output — it does not HTML-escape, and callers
 * must not HTML-decode it. Rendering code (JSX text nodes) is responsible for
 * escaping when these strings reach the page.
 */
export interface ResolvedPortalConfig extends Omit<PortalConfig, 'links' | 'pages' | 'entries' | 'copy'> {
  links: ResolvedPortalLinks;
  pages: {
    getting_started: ResolvedPortalPageConfig;
    rules: ResolvedPortalPageConfig;
    report_issue: ResolvedPortalPageConfig;
  };
  entries: ResolvedPortalEntry[];
  copy: ResolvedPortalCopy;
}

/** Page-relative hrefs for the three built-in content pages. */
const BUILTIN_PAGE_HREFS: Record<'getting_started' | 'rules' | 'report_issue', string> = {
  getting_started: 'getting-started',
  rules: 'rules',
  report_issue: 'report-issue',
};

function resolvePage(
  page: RawPortalPageConfig,
  defaults: { title: string; eyebrow: string },
  substitute: (value: string) => string,
): ResolvedPortalPageConfig {
  return {
    enabled: page.enabled,
    markdown: page.markdown,
    title: substitute(page.title ?? defaults.title),
    eyebrow: substitute(page.eyebrow ?? defaults.eyebrow),
  };
}

function resolvePages(
  pages: PortalConfig['pages'],
  substitute: (value: string) => string,
): ResolvedPortalConfig['pages'] {
  return {
    getting_started: resolvePage(pages.getting_started, DEFAULT_PAGE_COPY.getting_started, substitute),
    rules: resolvePage(pages.rules, DEFAULT_PAGE_COPY.rules, substitute),
    report_issue: resolvePage(pages.report_issue, DEFAULT_PAGE_COPY.report_issue, substitute),
  };
}

function resolveCopy(copy: PortalConfig['copy'], substitute: (value: string) => string): ResolvedPortalCopy {
  return {
    tagline: substitute(copy.tagline ?? DEFAULT_PORTAL_COPY.tagline),
    intro: substitute(copy.intro ?? DEFAULT_PORTAL_COPY.intro),
    tabTitle: substitute(copy.tab_title ?? DEFAULT_PORTAL_COPY.tab_title),
    tocHeading: substitute(copy.toc_heading ?? DEFAULT_PORTAL_COPY.toc_heading),
    stuckTitle: substitute(copy.stuck_title ?? DEFAULT_PORTAL_COPY.stuck_title),
    stuckBody: substitute(copy.stuck_body ?? DEFAULT_PORTAL_COPY.stuck_body),
    stuckLinkLabel: substitute(copy.stuck_link_label ?? DEFAULT_PORTAL_COPY.stuck_link_label),
    backLabel: substitute(copy.back_label ?? DEFAULT_PORTAL_COPY.back_label),
    footer: substitute(copy.footer ?? DEFAULT_PORTAL_COPY.footer),
    customPageEyebrow: substitute(copy.custom_page_eyebrow ?? DEFAULT_PORTAL_COPY.custom_page_eyebrow),
    showStuckCard: copy.show_stuck_card,
    showFooter: copy.show_footer,
  };
}

/** `entries ?? [...DEFAULT_PORTAL_ENTRIES, ...custom]`, per spec §1. */
function buildRawEntries(portal: PortalConfig): PortalEntry[] {
  if (portal.entries) return portal.entries;
  return [...DEFAULT_PORTAL_ENTRIES, ...portal.custom];
}

function builtinLinkHref(link: 'plex' | 'request' | 'status', links: ResolvedPortalLinks): string | undefined {
  if (link === 'plex') return links.plexUrl;
  if (link === 'request') return links.requestUrl;
  return links.statusUrl;
}

type UnnumberedEntry = Omit<ResolvedPortalEntry, 'number'>;

/** Maps one raw entry to its resolved shape, or `null` when it should be dropped (disabled page / unset URL). */
function mapEntry(
  entry: PortalEntry,
  pagesEnabled: Record<'getting_started' | 'rules' | 'report_issue', boolean>,
  links: ResolvedPortalLinks,
): UnnumberedEntry | null {
  switch (entry.type) {
    case 'builtin_page': {
      if (!pagesEnabled[entry.page]) return null;
      const defaults = DEFAULT_BUILTIN_PAGE_COPY[entry.page];
      return {
        kind: 'builtin_page',
        id: entry.page,
        label: entry.label ?? defaults.label,
        description: entry.description ?? defaults.description,
        href: BUILTIN_PAGE_HREFS[entry.page],
        external: false,
      };
    }
    case 'builtin_link': {
      const href = builtinLinkHref(entry.link, links);
      if (href === undefined) return null;
      const defaults = DEFAULT_BUILTIN_LINK_COPY[entry.link];
      return {
        kind: 'builtin_link',
        id: entry.link,
        label: entry.label ?? defaults.label,
        description: entry.description ?? defaults.description,
        href,
        external: true,
      };
    }
    case 'link':
      return {
        kind: 'link',
        id: entry.url,
        label: entry.label,
        description: entry.description,
        href: entry.url,
        external: true,
      };
    case 'page':
      return {
        kind: 'page',
        id: entry.slug,
        label: entry.label,
        description: entry.description,
        href: entry.slug,
        external: false,
      };
  }
}

function resolveEntries(
  portal: PortalConfig,
  links: ResolvedPortalLinks,
  substitute: (value: string) => string,
): ResolvedPortalEntry[] {
  const pagesEnabled = {
    getting_started: portal.pages.getting_started.enabled,
    rules: portal.pages.rules.enabled,
    report_issue: portal.pages.report_issue.enabled,
  };

  const visible = buildRawEntries(portal)
    .filter((entry) => !entry.hidden)
    .map((entry) => mapEntry(entry, pagesEnabled, links))
    .filter((entry): entry is UnnumberedEntry => entry !== null);

  return visible.map((entry, idx) => ({
    ...entry,
    label: substitute(entry.label),
    description: entry.description === undefined ? undefined : substitute(entry.description),
    number: String(idx + 1).padStart(2, '0'),
  }));
}

export function resolvePortalConfig(
  portal: PortalConfig,
  extras?: NewsletterConfig['extras'],
  serverName?: string,
): ResolvedPortalConfig {
  const links: ResolvedPortalLinks = {
    plexUrl: portal.links.plex_url,
    requestUrl: portal.links.request_url ?? extras?.request_url,
    requestLabel: portal.links.request_label ?? extras?.request_label,
    statusUrl: portal.links.status_url,
  };

  const vars = getPortalVariablesFromLinks(links, serverName ?? '');
  const tokens = toPortalTokens(vars);
  const substitute = (value: string) => substituteTokens(value, tokens);

  return {
    ...portal,
    links,
    pages: resolvePages(portal.pages, substitute),
    copy: resolveCopy(portal.copy, substitute),
    entries: resolveEntries(portal, links, substitute),
  };
}
