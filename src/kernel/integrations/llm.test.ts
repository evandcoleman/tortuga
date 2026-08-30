import { describe, it, expect, vi } from 'vitest';
import { createLlmClient, resolveLlmClient } from './llm';
import { LlmError } from './errors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createLlmClient', () => {
  it('anthropic: posts to Messages API with x-api-key + version headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ content: [{ type: 'text', text: 'hello' }] }));
    const c = createLlmClient({ provider: 'anthropic', apiKey: 'sk-ant', fetcher });
    const out = await c.generateText({ system: 'sys', prompt: 'p' });
    expect(out).toBe('hello');
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.system).toBe('sys');
    expect(body.messages).toEqual([{ role: 'user', content: 'p' }]);
  });

  it('openai: posts to chat completions with Bearer auth and system message', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: 'hi there' } }] }));
    const c = createLlmClient({ provider: 'openai', apiKey: 'sk-oai', model: 'gpt-4o-mini', fetcher });
    const out = await c.generateText({ system: 'sys', prompt: 'p' });
    expect(out).toBe('hi there');
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-oai');
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'p' },
    ]);
  });

  it('throws LlmError on a 4xx response', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: 'bad key' }, 401));
    const c = createLlmClient({ provider: 'anthropic', apiKey: 'bad', fetcher });
    await expect(c.generateText({ system: 's', prompt: 'p' })).rejects.toBeInstanceOf(LlmError);
  });
});

describe('resolveLlmClient', () => {
  const keys = (over: Record<string, string | undefined> = {}) => ({
    anthropicApiKey: undefined, openaiApiKey: undefined, ...over,
  }) as any;
  const cfg = (over: Record<string, unknown> = {}) => ({
    commentary: { enabled: false, provider: 'anthropic', model: '', voice: '', ...over },
  }) as any;

  it('returns null when commentary is disabled', () => {
    expect(resolveLlmClient(keys(), cfg())).toBeNull();
  });

  it('returns null (and does not throw) when enabled but the provider key is missing', () => {
    expect(resolveLlmClient(keys(), cfg({ enabled: true, provider: 'openai' }))).toBeNull();
  });

  it('builds a client when enabled and key present', () => {
    const c = resolveLlmClient(keys({ anthropicApiKey: 'sk-ant' }), cfg({ enabled: true }));
    expect(c).not.toBeNull();
    expect(typeof c!.generateText).toBe('function');
  });
});
