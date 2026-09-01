import { substituteTokens } from '@/modules/templates/substitute';
import { renderMarkdown } from '@/modules/templates/markdown';
import { toPortalTokens, type PortalVariables } from './variables';

/**
 * The portal's content pipeline: substitute `{{variables}}` first, then run
 * the result through the shared markdown renderer — the same two-step
 * pipeline `renderTemplate` uses for recipient emails.
 */
export function renderPortalMarkdown(markdown: string, vars: PortalVariables): string {
  const substituted = substituteTokens(markdown, toPortalTokens(vars));
  return renderMarkdown(substituted);
}
