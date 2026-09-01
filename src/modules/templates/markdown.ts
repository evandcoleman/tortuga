import { marked } from 'marked';

/**
 * Renders trusted, admin-authored markdown to HTML. Shared by every surface
 * that follows the "substitute variables, then render markdown" pipeline
 * (recipient email templates, the public portal). No sanitiser beyond what
 * `marked` itself applies — callers are responsible for treating the input
 * as trusted (admin-authored) content.
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}
