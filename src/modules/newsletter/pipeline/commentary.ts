import type { LlmClient } from '@/kernel/integrations/llm';
import { createLogger } from '@/kernel/logging/logger';
import type { EnrichedItem } from '../types';

const log = createLogger('newsletter.commentary');

export const DEFAULT_VOICE =
  'You are the warm, knowledgeable curator of a private media server. ' +
  "Write a single short paragraph (2-3 sentences) introducing this week's new additions. " +
  'Be specific and tasteful, never salesy or cliched. ' +
  'Do not greet, do not sign off, do not use markdown or lists — return plain prose only.';

export interface GenerateIntroOpts {
  appName: string;
  voice?: string;
}

export async function generateIntro(
  llm: LlmClient,
  items: EnrichedItem[],
  opts: GenerateIntroOpts,
): Promise<string | null> {
  try {
    const summary = items
      .map(i => {
        const year = i.year ? ` (${i.year})` : '';
        const rating = i.rating > 0 ? `, ${i.rating.toFixed(1)}/10` : '';
        return `- ${i.title}${year} [${i.mediaType}${rating}]`;
      })
      .join('\n');
    const system = opts.voice && opts.voice.trim().length > 0 ? opts.voice.trim() : DEFAULT_VOICE;
    const prompt = `These titles were just added to ${opts.appName}:\n${summary}\n\nWrite the intro paragraph.`;
    const text = await llm.generateText({ system, prompt, maxTokens: 400 });
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    log.warn({ err }, 'commentary generation failed; sending digest without intro');
    return null;
  }
}
