# Newsletter AI Commentary + Configurable Extras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in AI-generated editorial intro and configurable extras (request link, personal-site link, freeform markdown) to the Tortuga newsletter digest.

**Architecture:** A new kernel integration client (`llm.ts`) abstracts Anthropic/OpenAI behind a single `generateText` interface, built via `fetchWithRetry` like the other clients. A `resolveLlmClient` helper turns config+env into a client or `null` (disabled). The newsletter pipeline generates the intro once per digest (before the per-recipient send loop), degrades gracefully on failure, converts freeform markdown to HTML via `marked`, and passes everything as optional props to the existing `DigestEmail` template.

**Tech Stack:** TypeScript, Zod (config), Vitest (tests), `@react-email/components` (template), `marked` (markdown→HTML), plain `fetch` against Anthropic Messages API + OpenAI Chat Completions.

---

## Conventions

- Test runner: Vitest. Run a single file: `pnpm exec vitest run <file>`. Filter by name: add `-t "<name>"`.
- Full suite: `pnpm test`. Typecheck: `pnpm tsc --noEmit`.
- Mock HTTP with a `vi.fn()` fetcher returning `new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })` (see `src/kernel/integrations/tmdb.test.ts`).
- Commit after each task with a conventional-commit message.
- A repo hook ("Fact-Forcing Gate") may require you to state, before each edit: the files that import the target, affected public functions, any data fields touched, and the verbatim user instruction. Provide those facts and retry the edit.

---

## File Structure

- **Create** `src/kernel/integrations/llm.ts` — `LlmClient` interface, `createLlmClient`, `resolveLlmClient`.
- **Create** `src/kernel/integrations/llm.test.ts` — client request shapes, error throw, resolve logic.
- **Modify** `src/kernel/integrations/errors.ts` — add `'anthropic' | 'openai'` to the source union and an `LlmError` class.
- **Modify** `src/kernel/config/schema.ts` — `commentary` + `extras` blocks on `NewsletterConfigSchema`; `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` on `EnvSchema`.
- **Create** `src/kernel/config/schema.test.ts` — defaults + parsing of the new blocks.
- **Create** `src/modules/newsletter/pipeline/commentary.ts` — `generateIntro` + `DEFAULT_VOICE`.
- **Create** `src/modules/newsletter/pipeline/commentary.test.ts` — success, graceful-degradation, voice injection.
- **Modify** `src/modules/newsletter/templates/digest.tsx` — optional `intro` / `requestLink` / `personalLink` / `freeformHtml` props + render blocks.
- **Modify** `src/modules/newsletter/templates/digest.test.ts` — present/absent rendering.
- **Modify** `src/kernel/context.ts` — add `llm: LlmClient | null` to `AppContext`, build via `resolveLlmClient`.
- **Modify** `src/modules/newsletter/pipeline/run.ts` — `llm` opt, generate intro once, build extras props, pass to both renders.
- **Modify** `src/modules/newsletter/pipeline/run.test.ts` — degradation + "intro generated once" assertions.
- **Modify** `src/app/(admin)/newsletter/preview/page.tsx` — pass `ctx.llm` in the two `runDigest` calls.
- **Modify** `tortuga.example.yml` — documented `commentary` + `extras` blocks.
- **Modify** `package.json` — add `marked` dependency.

---

## Task 1: Config schema — env keys + commentary/extras blocks

**Files:**
- Modify: `src/kernel/config/schema.ts`
- Test: `src/kernel/config/schema.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/kernel/config/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NewsletterConfigSchema, EnvSchema } from './schema';

const base = { from: { email: 'a@b.io', name: 'T' } };

describe('NewsletterConfigSchema commentary/extras', () => {
  it('defaults commentary to disabled and extras to undefined', () => {
    const cfg = NewsletterConfigSchema.parse(base);
    expect(cfg.commentary.enabled).toBe(false);
    expect(cfg.commentary.provider).toBe('anthropic');
    expect(cfg.extras).toBeUndefined();
  });

  it('parses a full commentary + extras block', () => {
    const cfg = NewsletterConfigSchema.parse({
      ...base,
      commentary: { enabled: true, provider: 'openai', model: 'gpt-4o-mini', voice: 'snappy' },
      extras: { request_url: 'https://req.example', personal_url: 'https://example.com', freeform_markdown: '# hi' },
    });
    expect(cfg.commentary).toMatchObject({ enabled: true, provider: 'openai', model: 'gpt-4o-mini', voice: 'snappy' });
    expect(cfg.extras).toMatchObject({ request_url: 'https://req.example', request_label: 'Request a title' });
  });

  it('accepts optional ANTHROPIC_API_KEY / OPENAI_API_KEY in env', () => {
    const env = EnvSchema.parse({
      TAUTULLI_URL: 'http://t', TAUTULLI_API_KEY: 'k', TMDB_API_KEY: 'k',
      APP_URL: 'http://a', SESSION_SECRET: 'x'.repeat(32),
      ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oai',
    });
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant');
    expect(env.OPENAI_API_KEY).toBe('sk-oai');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/kernel/config/schema.test.ts`
Expected: FAIL — `cfg.commentary` is undefined / unknown keys stripped.

- [ ] **Step 3: Add env keys**

In `src/kernel/config/schema.ts`, inside `EnvSchema` (after `MAILGUN_WEBHOOK_SIGNING_KEY`), add:

```ts
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 4: Add commentary + extras to NewsletterConfigSchema**

In `src/kernel/config/schema.ts`, inside the `NewsletterConfigSchema` object (after the `plex` field), add:

```ts
  commentary: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['anthropic', 'openai']).default('anthropic'),
    model: z.string().default(''),
    voice: z.string().default(''),
  }).default(() => ({ enabled: false, provider: 'anthropic' as const, model: '', voice: '' })),
  extras: z.object({
    request_url: z.string().url().optional(),
    request_label: z.string().default('Request a title'),
    personal_url: z.string().url().optional(),
    personal_label: z.string().optional(),
    freeform_markdown: z.string().optional(),
  }).optional(),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/kernel/config/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/kernel/config/schema.ts src/kernel/config/schema.test.ts
git commit -m "feat(config): add newsletter commentary + extras schema and LLM env keys"
```

---

## Task 2: LLM client + LlmError

**Files:**
- Modify: `src/kernel/integrations/errors.ts`
- Create: `src/kernel/integrations/llm.ts`
- Test: `src/kernel/integrations/llm.test.ts` (create)

- [ ] **Step 1: Add the LlmError class**

In `src/kernel/integrations/errors.ts`, change the `source` union to include the providers and add the class:

```ts
export class IntegrationError extends Error {
  constructor(
    public readonly source: 'tautulli' | 'tmdb' | 'resend' | 'anthropic' | 'openai',
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'IntegrationError';
  }
}
```

Then append after `ResendError`:

```ts
export class LlmError extends IntegrationError {
  constructor(source: 'anthropic' | 'openai', m: string, s?: number, r = false, c?: unknown) {
    super(source, m, s, r, c);
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `src/kernel/integrations/llm.test.ts`:

```ts
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
  const env = (over: Record<string, string | undefined> = {}) => ({
    ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined, ...over,
  }) as any;
  const cfg = (over: Record<string, unknown> = {}) => ({
    commentary: { enabled: false, provider: 'anthropic', model: '', voice: '', ...over },
  }) as any;

  it('returns null when commentary is disabled', () => {
    expect(resolveLlmClient(env(), cfg())).toBeNull();
  });

  it('throws when enabled but the provider key is missing', () => {
    expect(() => resolveLlmClient(env(), cfg({ enabled: true, provider: 'openai' })))
      .toThrow(/OPENAI_API_KEY/);
  });

  it('builds a client when enabled and key present', () => {
    const c = resolveLlmClient(env({ ANTHROPIC_API_KEY: 'sk-ant' }), cfg({ enabled: true }));
    expect(c).not.toBeNull();
    expect(typeof c!.generateText).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/kernel/integrations/llm.test.ts`
Expected: FAIL — `./llm` module not found.

- [ ] **Step 4: Implement the client**

Create `src/kernel/integrations/llm.ts`:

```ts
import type { Env, NewsletterConfig } from '../config/schema';
import { LlmError } from './errors';
import { fetchWithRetry } from './http';

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

export function resolveLlmClient(
  env: Env,
  newsletter: NewsletterConfig,
  fetcher?: typeof fetch,
): LlmClient | null {
  const c = newsletter.commentary;
  if (!c?.enabled) return null;
  const apiKey = c.provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey) {
    const key = c.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    throw new Error(`newsletter.commentary.enabled is true but ${key} is not set`);
  }
  return createLlmClient({ provider: c.provider, apiKey, model: c.model, fetcher });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/kernel/integrations/llm.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/kernel/integrations/llm.ts src/kernel/integrations/llm.test.ts src/kernel/integrations/errors.ts
git commit -m "feat(integrations): add LLM client (Anthropic/OpenAI) with resolve helper"
```

---

## Task 3: generateIntro (commentary prompt)

**Files:**
- Create: `src/modules/newsletter/pipeline/commentary.ts`
- Test: `src/modules/newsletter/pipeline/commentary.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/modules/newsletter/pipeline/commentary.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { generateIntro } from './commentary';
import type { EnrichedItem } from '../types';

const items: EnrichedItem[] = [{
  guid: 'g1', title: 'A Movie', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date('2026-05-01T00:00:00Z'), year: 2021, rating: 7.4,
  posterUrl: null, overview: 'o',
}];

describe('generateIntro', () => {
  it('returns the trimmed blurb on success', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('  This week is great.  ') };
    const out = await generateIntro(llm, items, { appName: 'Tortuga' });
    expect(out).toBe('This week is great.');
  });

  it('returns null when the client throws (graceful degradation)', async () => {
    const llm = { generateText: vi.fn().mockRejectedValue(new Error('boom')) };
    const out = await generateIntro(llm, items, { appName: 'Tortuga' });
    expect(out).toBeNull();
  });

  it('uses the custom voice as the system prompt when provided', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('x') };
    await generateIntro(llm, items, { appName: 'Tortuga', voice: 'pirate captain' });
    expect(llm.generateText.mock.calls[0][0].system).toContain('pirate captain');
  });

  it('returns null when the model returns empty text', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('   ') };
    expect(await generateIntro(llm, items, { appName: 'Tortuga' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/modules/newsletter/pipeline/commentary.test.ts`
Expected: FAIL — `./commentary` not found.

- [ ] **Step 3: Implement generateIntro**

Create `src/modules/newsletter/pipeline/commentary.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/modules/newsletter/pipeline/commentary.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/newsletter/pipeline/commentary.ts src/modules/newsletter/pipeline/commentary.test.ts
git commit -m "feat(newsletter): generateIntro with default voice and graceful degradation"
```

---

## Task 4: DigestEmail template props

**Files:**
- Modify: `src/modules/newsletter/templates/digest.tsx`
- Test: `src/modules/newsletter/templates/digest.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/newsletter/templates/digest.test.ts` inside the `describe('DigestEmail', ...)` block:

```ts
  it('renders intro, links, and freeform when present', async () => {
    const html = await render(
      DigestEmail({
        ...baseProps,
        intro: 'A curated week of cinema.',
        requestLink: { url: 'https://req.example', label: 'Request a title' },
        personalLink: { url: 'https://example.com', label: 'example.com' },
        freeformHtml: '<p>Maintenance Sunday.</p>',
      }),
    );
    expect(html).toContain('A curated week of cinema.');
    expect(html).toContain('https://req.example');
    expect(html).toContain('Request a title');
    expect(html).toContain('https://example.com');
    expect(html).toContain('Maintenance Sunday.');
  });

  it('omits intro/links/freeform when absent', async () => {
    const html = await render(DigestEmail(baseProps));
    expect(html).not.toContain('Request a title');
    expect(html).not.toContain('Maintenance Sunday.');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/modules/newsletter/templates/digest.test.ts`
Expected: FAIL — props not in type / content not rendered.

- [ ] **Step 3: Extend the props interface**

In `src/modules/newsletter/templates/digest.tsx`, replace the `DigestEmailProps` interface with:

```ts
export interface DigestLink {
  url: string;
  label: string;
}

export interface DigestEmailProps {
  items: EnrichedItem[];
  unsubscribeUrl: string;
  appName: string;
  windowStart: Date;
  windowEnd: Date;
  intro?: string;
  requestLink?: DigestLink;
  personalLink?: DigestLink;
  freeformHtml?: string;
}
```

- [ ] **Step 4: Destructure the new props**

In `src/modules/newsletter/templates/digest.tsx`, update the `DigestEmail` function signature destructuring to:

```ts
export function DigestEmail({
  items,
  unsubscribeUrl,
  appName,
  windowStart,
  windowEnd,
  intro,
  requestLink,
  personalLink,
  freeformHtml,
}: DigestEmailProps) {
```

- [ ] **Step 5: Render the intro after the masthead**

In `src/modules/newsletter/templates/digest.tsx`, locate the masthead `</Section>` immediately followed by the first `<Hr` (the one with `margin: '28px 0 0'`). Insert the intro block between that `</Section>` and the `<Hr`:

```tsx
          </Section>

          {intro ? (
            <Section style={{ marginTop: 20 }}>
              <Text
                style={{
                  margin: 0,
                  fontFamily: FONT_SERIF,
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: PALETTE.ink,
                  fontStyle: 'italic',
                }}
              >
                {intro}
              </Text>
            </Section>
          ) : null}

          <Hr
```

- [ ] **Step 6: Render freeform + links before the footer**

In `src/modules/newsletter/templates/digest.tsx`, find the footer divider `<Hr` with `margin: '48px 0 20px'`. Insert this block immediately BEFORE that `<Hr`:

```tsx
          {freeformHtml ? (
            <Section
              style={{
                marginTop: 40,
                background: PALETTE.cardBg,
                border: `1px solid ${PALETTE.hairline}`,
                borderRadius: 6,
                padding: 16,
              }}
            >
              <div
                style={{ fontSize: 14, lineHeight: 1.55, color: PALETTE.ink }}
                dangerouslySetInnerHTML={{ __html: freeformHtml }}
              />
            </Section>
          ) : null}

          {requestLink || personalLink ? (
            <Section style={{ marginTop: 32, textAlign: 'center' }}>
              {requestLink ? (
                <Link
                  href={requestLink.url}
                  style={{
                    display: 'inline-block',
                    margin: '0 8px',
                    padding: '10px 18px',
                    borderRadius: 999,
                    background: PALETTE.accent,
                    color: PALETTE.paper,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    letterSpacing: 0.2,
                  }}
                >
                  {requestLink.label}
                </Link>
              ) : null}
              {personalLink ? (
                <Link
                  href={personalLink.url}
                  style={{
                    display: 'inline-block',
                    margin: '0 8px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: PALETTE.accent,
                    textDecoration: 'none',
                  }}
                >
                  {personalLink.label}
                </Link>
              ) : null}
            </Section>
          ) : null}

          <Hr
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec vitest run src/modules/newsletter/templates/digest.test.ts`
Expected: PASS (all, including the 2 new tests).

- [ ] **Step 8: Commit**

```bash
git add src/modules/newsletter/templates/digest.tsx src/modules/newsletter/templates/digest.test.ts
git commit -m "feat(newsletter): render intro, request/personal links, freeform block in digest"
```

---

## Task 5: Pipeline wiring — generate intro once, build extras, marked

**Files:**
- Modify: `package.json` (add `marked`)
- Modify: `src/modules/newsletter/pipeline/run.ts`
- Test: `src/modules/newsletter/pipeline/run.test.ts`

- [ ] **Step 1: Add the marked dependency**

Run: `pnpm add marked`
Expected: `marked` appears in `package.json` dependencies and installs cleanly.

- [ ] **Step 2: Write the failing tests**

In `src/modules/newsletter/pipeline/run.test.ts`, replace the `fakes()` function with a version that returns an `llm` mock and two recipients:

```ts
function fakes() {
  const tautulli = {
    getUsers: vi.fn().mockResolvedValue([
      { plexUserId: 1, name: 'A', plexUsername: 'a', email: 'a@x.io' },
      { plexUserId: 2, name: 'B', plexUsername: 'b', email: 'b@x.io' },
    ]),
    getRecentlyAdded: vi.fn().mockResolvedValue([
      { guid: 'g1', title: 'M', mediaType: 'movie', libraryName: 'Movies', addedAt: new Date(), year: 2020, raw: {} },
    ]),
  };
  const tmdb = {
    searchMovie: vi.fn().mockResolvedValue({ id: 1, title: 'M', rating: 8, posterUrl: null, overview: 'o' }),
    searchTv: vi.fn(),
  };
  const provider = {
    name: 'resend' as const,
    send: vi.fn().mockResolvedValue({ providerMessageId: 'msg_1', error: null }),
    verifyWebhook: vi.fn(),
    parseEvent: vi.fn(),
  };
  const llm = { generateText: vi.fn().mockResolvedValue('An editorial intro.') };
  return { tautulli, tmdb, provider, llm };
}
```

Then add these tests inside `describe('runDigest', ...)`:

```ts
  it('generates the intro exactly once even with multiple recipients', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider, llm } = fakes();
    await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: { ...baseConfig, commentary: { enabled: true, provider: 'anthropic', model: '', voice: '' } } as any,
      appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-14T13:00:00Z'), llm: llm as any,
    });
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(llm.generateText).toHaveBeenCalledTimes(1);
  });

  it('still sends when the LLM throws (graceful degradation)', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const { tautulli, tmdb, provider, llm } = fakes();
    llm.generateText.mockRejectedValue(new Error('boom'));
    const result = await runDigest({
      db, tautulli: tautulli as any, tmdb: tmdb as any, provider: provider as any,
      config: { ...baseConfig, commentary: { enabled: true, provider: 'anthropic', model: '', voice: '' } } as any,
      appUrl: 'http://x', sessionSecret: 'x'.repeat(32),
      scheduledAt: new Date('2026-05-15T13:00:00Z'), llm: llm as any,
    });
    expect(result.status).toBe('sent');
  });
```

Note: the existing single-recipient tests still use the same `fakes()`; they assert `result.itemCount`/`status` (not recipient counts), so adding a second recipient does not break them.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run src/modules/newsletter/pipeline/run.test.ts`
Expected: FAIL — `llm` not accepted / intro not generated.

- [ ] **Step 4: Wire run.ts**

In `src/modules/newsletter/pipeline/run.ts`:

(a) Add imports (after the existing `import { DigestEmail } from '../templates/digest';` line):

```ts
import { marked } from 'marked';
import type { LlmClient } from '@/kernel/integrations/llm';
import type { DigestLink } from '../templates/digest';
import { generateIntro } from './commentary';
```

(b) Add `llm` to the `RunDigestOpts` interface (after `recipientFilter?`):

```ts
  llm?: LlmClient | null;
```

(c) After the `withPlexLinks` block (immediately before the `placeholderUnsub` line), insert:

```ts
    const intro = opts.llm
      ? await generateIntro(opts.llm, withPlexLinks, {
          appName: opts.config.from.name,
          voice: opts.config.commentary?.voice,
        })
      : null;

    const extras = opts.config.extras;
    const requestLink: DigestLink | undefined = extras?.request_url
      ? { url: extras.request_url, label: extras.request_label ?? 'Request a title' }
      : undefined;
    const personalLink: DigestLink | undefined = extras?.personal_url
      ? { url: extras.personal_url, label: extras.personal_label ?? new URL(extras.personal_url).host }
      : undefined;
    const freeformHtml = extras?.freeform_markdown
      ? (marked.parse(extras.freeform_markdown, { async: false }) as string)
      : undefined;
```

(d) Update BOTH `createElement(DigestEmail, { ... })` prop objects (the dry-run render near line 70 and the per-recipient render near line 99). In each, add these lines alongside `windowStart` / `windowEnd`:

```ts
        intro: intro ?? undefined,
        requestLink,
        personalLink,
        freeformHtml,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/modules/newsletter/pipeline/run.test.ts`
Expected: PASS (all, including the 2 new tests).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/modules/newsletter/pipeline/run.ts src/modules/newsletter/pipeline/run.test.ts
git commit -m "feat(newsletter): generate intro once and wire extras into digest render"
```

---

## Task 6: Context wiring + preview page

**Files:**
- Modify: `src/kernel/context.ts`
- Modify: `src/app/(admin)/newsletter/preview/page.tsx`

- [ ] **Step 1: Add llm to AppContext**

In `src/kernel/context.ts`:

(a) Add the import near the other integration imports:

```ts
import { resolveLlmClient, type LlmClient } from './integrations/llm';
```

(b) Add to the `AppContext` interface (after `email: EmailProvider;`):

```ts
  llm: LlmClient | null;
```

(c) In `getAppContext()`, after the `const email = ...` line and before `const scheduler = ...`, add:

```ts
  const llm = resolveLlmClient(env, config.newsletter);
```

(d) Add `llm` to the `cached = { ... }` object:

```ts
  cached = { env, config, db, tautulli, tmdb, email, llm, scheduler };
```

- [ ] **Step 2: Pass ctx.llm in the preview page**

In `src/app/(admin)/newsletter/preview/page.tsx`, in BOTH `runDigest({ ... })` calls (inside `generate()` and `send()`), add `llm: ctx.llm,` to the options object (e.g. immediately after `provider: ctx.email,`).

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/kernel/context.ts "src/app/(admin)/newsletter/preview/page.tsx"
git commit -m "feat(newsletter): wire LLM client into app context and preview render"
```

---

## Task 7: Document config in tortuga.example.yml

**Files:**
- Modify: `tortuga.example.yml`

- [ ] **Step 1: Append documented blocks**

Add to the end of the `newsletter:` block in `tortuga.example.yml` (same indentation as the existing `featured:` / `plex:` keys):

```yaml
  # Optional. AI-generated editorial intro paragraph at the top of the digest.
  # Requires ANTHROPIC_API_KEY (provider: anthropic) or OPENAI_API_KEY (provider: openai)
  # in the environment when enabled.
  commentary:
    enabled: false
    provider: anthropic        # anthropic | openai
    model: ""                  # optional; defaults: claude-haiku-4-5 / gpt-4o-mini
    voice: ""                  # optional; freeform tone instructions, e.g.
                               # "witty film-buff concierge, a little irreverent"
  # Optional. Extra links and a freeform block rendered in the digest footer.
  extras:
    request_url: "https://requests.example.com"   # your Overseerr/Ombi/request site
    request_label: "Request a title"
    personal_url: "https://example.com"
    personal_label: "example.com"
    freeform_markdown: |
      Reminder: please don't delete other people's watch history.
```

- [ ] **Step 2: Verify it parses**

Run: `pnpm exec vitest run src/kernel/config/load.test.ts`
Expected: PASS (existing loader tests still green).

- [ ] **Step 3: Commit**

```bash
git add tortuga.example.yml
git commit -m "docs(config): document commentary + extras in example config"
```

---

## Final Verification

- [ ] Run full suite: `pnpm test` — all pass.
- [ ] Typecheck: `pnpm tsc --noEmit` — exit 0.
- [ ] Build: `pnpm build` — succeeds.
- [ ] Sanity: with `commentary.enabled: false` and no `extras`, a rendered digest is unchanged from current behavior (intro/links/freeform absent).

---

## Self-Review Notes

- **Spec coverage:** config schema (Task 1), env keys (Task 1), LLM client + both providers + LlmError (Task 2), resolve/cross-validation (Task 2), generateIntro + default voice + degradation (Task 3), template props (Task 4), generate-once + marked + extras wiring (Task 5), context + preview call sites (Task 6), example config (Task 7). All spec sections covered.
- **Cross-validation location:** spec left this open; implemented as `resolveLlmClient(env, newsletter)` co-located with the client (cleaner than a separate `assertCommentaryConfig`). Throws a clear error when enabled without a key.
- **Type consistency:** `DigestLink` defined in Task 4 and imported in Task 5; `LlmClient` defined in Task 2 and used in Tasks 3/5/6; `generateIntro` signature matches between Task 3 (definition) and Task 5 (call). `commentary.voice` is `string` (empty default); passed straight to `generateIntro`, which treats empty/whitespace as "use default voice".
- **Markdown safety:** `marked.parse` with `{ async: false }` returns a `string`. Content is operator-authored config (trusted), rendered via `dangerouslySetInnerHTML` in a contained block — no untrusted user input path.
