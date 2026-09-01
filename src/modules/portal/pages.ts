import type { ResolvedPortalConfig } from '@/kernel/config/portal';
import {
  GETTING_STARTED_MARKDOWN,
  GETTING_STARTED_TITLE,
  RULES_MARKDOWN,
  RULES_TITLE,
  REPORT_ISSUE_MARKDOWN,
  REPORT_ISSUE_TITLE,
} from './copy';
import { renderPortalMarkdown } from './render';
import type { PortalVariables } from './variables';

export type BuiltinPortalPageKey = 'getting_started' | 'rules' | 'report_issue';

export interface PortalPageContent {
  title: string;
  /** Already-rendered HTML — markdown has gone through substitution + `marked`. */
  html: string;
}

const BUILTIN_PAGES: Record<BuiltinPortalPageKey, { title: string; defaultMarkdown: string }> = {
  getting_started: { title: GETTING_STARTED_TITLE, defaultMarkdown: GETTING_STARTED_MARKDOWN },
  rules: { title: RULES_TITLE, defaultMarkdown: RULES_MARKDOWN },
  report_issue: { title: REPORT_ISSUE_TITLE, defaultMarkdown: REPORT_ISSUE_MARKDOWN },
};

/**
 * Resolves one of the three built-in content pages. Returns `null` when the
 * page is disabled (callers should 404). A configured `markdown` override
 * *replaces* the default body entirely — no append mode, per spec.
 */
export function getBuiltinPortalPage(
  key: BuiltinPortalPageKey,
  portal: ResolvedPortalConfig,
  vars: PortalVariables,
): PortalPageContent | null {
  const page = portal.pages[key];
  if (!page.enabled) return null;

  const def = BUILTIN_PAGES[key];
  const markdown = page.markdown && page.markdown.trim().length > 0 ? page.markdown : def.defaultMarkdown;
  return { title: def.title, html: renderPortalMarkdown(markdown, vars) };
}

/**
 * Resolves a custom `page`-type entry by slug. Returns `null` when there's
 * no such entry (callers should 404) — custom entries have no `enabled`
 * flag; being present in the list is enough. Markdown bodies go through the
 * same substitution + markdown pipeline as built-ins; `html` bodies are
 * rendered verbatim (admin-authored, trusted — no substitution).
 */
export function getCustomPortalPage(
  portal: ResolvedPortalConfig,
  slug: string,
  vars: PortalVariables,
): PortalPageContent | null {
  const entry = portal.custom.find((e) => e.type === 'page' && e.slug === slug);
  if (!entry || entry.type !== 'page') return null;

  const html = entry.markdown ? renderPortalMarkdown(entry.markdown, vars) : (entry.html ?? '');
  return { title: entry.label, html };
}
