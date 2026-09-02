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

export interface SplitLeadResult {
  /** The rendered HTML of the first `<p>`, if the body starts with one — `null` otherwise. */
  lead: string | null;
  /** The remainder of the body with the lead paragraph removed (unchanged when there's no lead). */
  rest: string;
}

const LEADING_P_RE = /^\s*<p(?:\s[^>]*)?>([\s\S]*?)<\/p>\s*/;

/**
 * Pulls the first paragraph out of rendered HTML for use as a masthead
 * italic intro line — but only when the body actually starts with one (a
 * page that opens with a heading or list gets no intro line).
 */
export function splitLead(html: string): SplitLeadResult {
  const match = html.match(LEADING_P_RE);
  if (!match) return { lead: null, rest: html };
  return { lead: match[1], rest: html.slice(match[0].length) };
}

export interface TocEntry {
  id: string;
  text: string;
}

export interface AddHeadingIdsResult {
  html: string;
  toc: TocEntry[];
}

const H2_RE = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Decodes the common HTML entities used in rendered TOC heading text
 * (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`/`&apos;`, plus numeric decimal
 * and hex references) so React doesn't double-escape them when the text is
 * rendered as a plain string.
 */
function isValidCodePoint(code: number): boolean {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
}

function decodeNumericEntity(fullMatch: string, code: number): string {
  if (!isValidCodePoint(code)) {
    return fullMatch;
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return fullMatch;
  }
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (fullMatch, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? fullMatch : decodeNumericEntity(fullMatch, code);
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? fullMatch : decodeNumericEntity(fullMatch, code);
    }
    return NAMED_ENTITIES[entity] ?? fullMatch;
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

/**
 * Adds `id` attributes to every `<h2>` in rendered HTML (slugified from its
 * text, de-duped when headings repeat) and returns a table of contents built
 * from the same headings, in document order.
 */
export function addHeadingIds(html: string): AddHeadingIdsResult {
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];

  const result = html.replace(H2_RE, (fullMatch, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    toc.push({ id, text: decodeHtmlEntities(text) });
    return fullMatch.replace(/^<h2/, `<h2 id="${id}"`);
  });

  return { html: result, toc };
}
