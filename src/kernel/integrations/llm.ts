import type { NewsletterConfig } from '../config/schema';
import { LlmError } from './errors';
import { fetchWithRetry } from './http';
import { createLogger } from '../logging/logger';

const log = createLogger('integrations.llm');

export type LlmProvider = 'anthropic' | 'openai';

export interface LlmClient {
  generateText(args: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}

export interface LlmOpts {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
}

const DEFAULT_MODEL: Record<LlmProvider, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
};

export function createLlmClient(opts: LlmOpts): LlmClient {
  const model = opts.model && opts.model.length > 0 ? opts.model : DEFAULT_MODEL[opts.provider];

  return {
    async generateText({ system, prompt, maxTokens = 400 }) {
      if (opts.provider === 'anthropic') {
        const res = await fetchWithRetry(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': opts.apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              system,
              messages: [{ role: 'user', content: prompt }],
            }),
          },
          { fetcher: opts.fetcher },
        );
        if (!res.ok) throw new LlmError('anthropic', `HTTP ${res.status}`, res.status, res.status >= 500);
        const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
        return data.content.map(c => c.text ?? '').join('').trim();
      }

      const res = await fetchWithRetry(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${opts.apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
          }),
        },
        { fetcher: opts.fetcher },
      );
      if (!res.ok) throw new LlmError('openai', `HTTP ${res.status}`, res.status, res.status >= 500);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return (data.choices[0]?.message.content ?? '').trim();
    },
  };
}

/** Effective (env-or-db resolved) API keys for the LLM providers commentary can use. */
export interface LlmProviderKeys {
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

export function resolveLlmClient(
  keys: LlmProviderKeys,
  newsletter: NewsletterConfig,
  fetcher?: typeof fetch,
): LlmClient | null {
  const c = newsletter.commentary;
  if (!c?.enabled) return null;
  const apiKey = c.provider === 'anthropic' ? keys.anthropicApiKey : keys.openaiApiKey;
  if (!apiKey) {
    const key = c.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    log.warn({ provider: c.provider }, `newsletter.commentary.enabled is true but ${key} is not set; disabling commentary`);
    return null;
  }
  return createLlmClient({ provider: c.provider, apiKey, model: c.model, fetcher });
}
