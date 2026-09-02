import type { PortalConfig, PortalEntry } from '@/kernel/config/schema';
import type { ResolvedPortalConfig } from '@/kernel/config/portal';
import { substituteTokens } from '@/modules/templates/substitute';
import {
  DEFAULT_PORTAL_ENTRIES,
  GETTING_STARTED_MARKDOWN,
  RULES_MARKDOWN,
  REPORT_ISSUE_MARKDOWN,
} from './copy';
import { renderPortalMarkdown } from './render';
import { toPortalTokens, type PortalVariables } from './variables';

export type BuiltinPortalPageKey = 'getting_started' | 'rules' | 'report_issue';

export interface PortalPageContent {
  title: string;
  /** Already-rendered HTML — markdown has gone through substitution + `marked`. */
  html: string;
}

const BUILTIN_DEFAULT_MARKDOWN: Record<BuiltinPortalPageKey, string> = {
  getting_started: GETTING_STARTED_MARKDOWN,
  rules: RULES_MARKDOWN,
  report_issue: REPORT_ISSUE_MARKDOWN,
};

/**
 * Resolves one of the three built-in content pages. Returns `null` when the
 * page is disabled (callers should 404). A configured `markdown` override
 * *replaces* the default body entirely — no append mode, per spec. Title
 * comes from the already-resolved (and token-substituted) `portal.pages`
 * config — resolution already applied the default/override fallback.
 */
export function getBuiltinPortalPage(
  key: BuiltinPortalPageKey,
  portal: ResolvedPortalConfig,
  vars: PortalVariables,
): PortalPageContent | null {
  const page = portal.pages[key];
  if (!page.enabled) return null;

  const defaultMarkdown = BUILTIN_DEFAULT_MARKDOWN[key];
  const markdown = page.markdown && page.markdown.trim().length > 0 ? page.markdown : defaultMarkdown;
  return { title: page.title, html: renderPortalMarkdown(markdown, vars) };
}

/**
 * The full configured entry list, unfiltered — includes hidden rows and
 * rows for disabled/unset built-ins. Mirrors `resolvePortalConfig`'s
 * `entries ?? [...DEFAULT_PORTAL_ENTRIES, ...custom]` fallback (kernel
 * doesn't expose this unfiltered list itself, since its resolved `entries`
 * is visible-rows-only — see docs/specs/2026-09-01-portal-copy-and-index.md
 * §1, "hidden pages still serve at their slug").
 */
function allConfiguredEntries(portal: PortalConfig): PortalEntry[] {
  return portal.entries ?? [...DEFAULT_PORTAL_ENTRIES, ...portal.custom];
}

/**
 * Resolves a custom `page`-type entry by slug, from the raw (unresolved)
 * portal config — so hidden custom pages still serve at their slug even
 * though they're dropped from `ResolvedPortalConfig.entries`. Returns `null`
 * when there's no such entry (callers should 404). Markdown bodies go
 * through the same substitution + markdown pipeline as built-ins; `html`
 * bodies are rendered verbatim (admin-authored, trusted — no substitution).
 */
export function getCustomPortalPage(
  rawPortal: PortalConfig,
  slug: string,
  vars: PortalVariables,
): PortalPageContent | null {
  const entry = allConfiguredEntries(rawPortal).find((e) => e.type === 'page' && e.slug === slug);
  if (!entry || entry.type !== 'page') return null;

  const title = substituteTokens(entry.label, toPortalTokens(vars));
  const html = entry.markdown ? renderPortalMarkdown(entry.markdown, vars) : (entry.html ?? '');
  return { title, html };
}
