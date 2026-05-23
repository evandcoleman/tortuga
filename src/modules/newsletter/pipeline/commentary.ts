import type { LlmClient } from '@/kernel/integrations/llm';
import { createLogger } from '@/kernel/logging/logger';
import type { EnrichedItem } from '../types';

const log = createLogger('newsletter.commentary');

// A title's release year is only worth showing the model when it's this many
// years older than the newest item in the drop (otherwise it's just noise).
const MIN_VINTAGE_GAP_YEARS = 3;

// Cap each title's synopsis so a large drop can't blow up the prompt.
const MAX_SYNOPSIS_CHARS = 200;

export const DEFAULT_VOICE =
  'You are the warm, knowledgeable curator of a private media server. ' +
  "Write a single short paragraph (2-3 sentences) introducing this week's new additions. " +
  'Be specific and tasteful, never salesy or cliched. ' +
  'Do not greet, do not sign off, do not use markdown or lists — return plain prose only.';

export interface GenerateIntroOpts {
  appName: string;
  voice?: string;
}

// The intro renders as escaped plaintext, and models ignore "no markdown"
// instructions, so strip markdown to plain prose before it reaches the email.
export function stripMarkdown(input: string): string {
  const withoutHeadings = input
    .split('\n')
    .filter(line => !/^\s{0,3}#{1,6}(\s|$)/.test(line))
    .map(line =>
      line
        .replace(/^\s{0,3}>\s?/, '')
        .replace(/^\s{0,3}([-*+]|\d+\.)\s+/, ''),
    )
    .join('\n');

  return withoutHeadings
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*\*|\*\*|\*|___|__|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateIntro(
  llm: LlmClient,
  items: EnrichedItem[],
  opts: GenerateIntroOpts,
): Promise<string | null> {
  try {
    // Most weekly drops are dominated by current-year titles. Repeating the year
    // on every line makes the model fixate on it, so only surface a year when a
    // title is notably older than the newest item — i.e. a back-catalog oddity.
    const newestYear = Math.max(0, ...items.map(i => i.year ?? 0));
    const summary = items
      .map(i => {
        const isVintage = i.year != null && newestYear - i.year >= MIN_VINTAGE_GAP_YEARS;
        const year = isVintage ? ` (${i.year})` : '';
        const rating = i.rating > 0 ? `, ${i.rating.toFixed(1)}/10` : '';
        const genres = i.genres?.length ? ` — ${i.genres.slice(0, 3).join('/')}` : '';
        const synopsis = i.overview?.trim()
          ? `: ${i.overview.trim().replace(/\s+/g, ' ').slice(0, MAX_SYNOPSIS_CHARS)}`
          : '';
        return `- ${i.title}${year} [${i.mediaType}${rating}]${genres}${synopsis}`;
      })
      .join('\n');
    const system = opts.voice && opts.voice.trim().length > 0 ? opts.voice.trim() : DEFAULT_VOICE;
    const prompt =
      `These titles were just added to ${opts.appName}. ` +
      'Base every description on the details below — do not invent plots, genres, seasons, years, or any fact ' +
      'about a title you were not given. If you lack details, stay general.\n\n' +
      `${summary}\n\nWrite the intro paragraph.`;
    const text = await llm.generateText({ system, prompt, maxTokens: 400 });
    const cleaned = stripMarkdown(text);
    return cleaned.length > 0 ? cleaned : null;
  } catch (err) {
    log.warn({ err }, 'commentary generation failed; sending digest without intro');
    return null;
  }
}
