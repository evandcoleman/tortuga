# Newsletter AI Commentary + Configurable Extras — Design

**Date:** 2026-05-21
**Status:** Approved (design); pending implementation plan

## Summary

Add two capabilities to the Tortuga newsletter digest:

1. **AI editorial intro** — a single short "curator's note" paragraph generated per
   digest by an LLM (Anthropic Claude or OpenAI), in a configurable voice.
2. **Configurable extras** — a request-site link, a personal-site link, and a
   freeform markdown block, all rendered in the digest.

Both features are opt-in and degrade gracefully: if the LLM call fails the digest
still sends without the intro; if an extra is unset it renders nothing.

## Decisions (from brainstorming)

- **Commentary scope:** single editorial intro for the whole digest (one LLM call).
  Not per-item blurbs, not curator's picks.
- **Voice control:** freeform custom instructions string in config, with a sensible
  default voice shipped so it works well out of the box.
- **Extras selected:** request-site link, personal-site link, freeform markdown block.
  (No dedicated "server rules" block — rules can live in the freeform block.)
- **Failure behavior:** graceful degradation. LLM failure logs and sends without the
  intro rather than failing the run.
- **API keys:** stored in env, never in YAML.

## Config schema changes

Two new optional blocks under `newsletter` in `src/kernel/config/schema.ts`
(`NewsletterConfigSchema`):

```yaml
newsletter:
  commentary:
    enabled: false                 # default off
    provider: anthropic            # 'anthropic' | 'openai'
    model: ""                      # optional; default per provider when empty
    voice: ""                      # optional custom instructions; default shipped
  extras:
    request_url: "https://requests.example.com"   # optional
    request_label: "Request a title"              # optional, has default
    personal_url: "https://example.com"                # optional
    personal_label: "example.com"                      # optional, defaults to URL host
    freeform_markdown: |                          # optional
      Heads up: server maintenance this weekend.
```

- `commentary` and `extras` are both optional with safe defaults (feature off / no extras).
- Provider enum: `'anthropic' | 'openai'`.
- Default models (used when `model` is empty): `claude-haiku-4-5` (Anthropic),
  `gpt-4o-mini` (OpenAI). Cheap models are correct for one short blurb.

### Env (`EnvSchema`)

Add optional keys:

```
ANTHROPIC_API_KEY  (optional)
OPENAI_API_KEY     (optional)
```

A Zod `superRefine` on the combined config enforces: when `commentary.enabled` is
true, the selected provider's key must be present. Missing key → clear startup error,
not a silent runtime failure. (Note: env + YAML are validated separately today; the
cross-check happens where both are available — in `getAppContext()` / a small
validation helper — see Open Implementation Notes.)

## LLM client (kernel integration)

New `src/kernel/integrations/llm.ts`, mirroring `tmdb.ts` and the email factory:

```ts
export interface LlmClient {
  generateText(args: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}

export function createLlmClient(opts: {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
}): LlmClient;
```

- One interface, two internal implementations (Anthropic Messages API, OpenAI Chat
  Completions) behind it.
- Uses the existing `fetchWithRetry` helper (`src/kernel/integrations/http.ts`) so 5xx
  responses retry consistently with the other clients.
- Errors throw a typed error (new `LlmError` in `integrations/errors.ts`, matching the
  `TmdbError`/`TautulliError` pattern).

### Context wiring

`AppContext` gains `llm: LlmClient | null` (null when commentary disabled or no key).
Built in `getAppContext()` alongside `tautulli` / `tmdb`.

## Pipeline wiring + prompt

New `src/modules/newsletter/pipeline/commentary.ts` owns the domain prompt:

```ts
export async function generateIntro(
  llm: LlmClient,
  items: EnrichedItem[],
  opts: { voice?: string; appName: string },
): Promise<string | null>;
```

- Builds a compact summary of the filtered items (title, type, year, rating) and asks
  for one short paragraph in the configured voice (default voice shipped as a constant).
- Wrapped in try/catch: on any failure, logs via the newsletter logger and returns
  `null`. Caller renders without an intro.

### `run.ts` changes

- After `withPlexLinks` is computed, generate the intro **once** (before the
  per-recipient send loop) and reuse the same string for the dry-run render and every
  per-recipient render. Must NOT call the LLM once per recipient.
- Convert `extras.freeform_markdown` to email-safe HTML **once** via `marked`. Content
  is operator-authored config (trusted, not user input), but it is still rendered into a
  styled, contained block. Pass derived `requestLink` / `personalLink` objects (or
  `undefined`) into the template props.
- `RunDigestOpts` gains `llm?: LlmClient | null`. The two call sites in the preview
  page (`generate`, `send`) pass `ctx.llm`.

## Template changes (`digest.tsx`)

`DigestEmailProps` gains optional fields:

```ts
intro?: string;
requestLink?: { url: string; label: string };
personalLink?: { url: string; label: string };
freeformHtml?: string;
```

- `intro` → styled lead paragraph below the masthead.
- `requestLink` / `personalLink` → footer action row.
- `freeformHtml` → its own bordered block (rendered HTML from markdown).
- All optional; absent props render nothing, so existing digests are byte-for-byte
  unchanged when the features are off.

## Testing

- **LLM client** (`llm.test.ts`): mocked `fetcher` asserts the correct request shape per
  provider (endpoint, auth header, body) and that 5xx triggers retry.
- **`generateIntro`** (`commentary.test.ts`): returns the blurb on success; returns
  `null` when the client throws (graceful degradation); injects custom voice when set.
- **`DigestEmail`** (`digest.test.ts`): intro / links / freeform render when present and
  are absent when omitted.
- **`run.ts`** (`run.test.ts`): the digest run still succeeds (status `rendered`/`sent`)
  when the LLM throws; the intro is generated once (LLM `generateText` called exactly
  once even with multiple recipients).

## Dependencies

- `marked` (markdown → HTML). Small, well-maintained, no native deps.
- No SDK needed for the LLM providers — plain `fetch` against the REST APIs via
  `fetchWithRetry` keeps the dependency surface minimal and consistent with `tmdb.ts`.

## Out of scope (YAGNI)

- Per-item commentary, curator's picks, multiple intros.
- Manual edit/override of the generated intro in the admin UI (regenerate via "Generate
  fresh preview" is sufficient for now).
- Caching the intro across digests (it is cheap and per-digest).
- A dedicated server-rules config block (freeform markdown covers it).

## Open implementation notes

- Decide the exact location of the env-vs-config cross-validation (`commentary.enabled`
  ⇒ provider key present). Likely a small `assertCommentaryConfig(env, config)` helper
  called in `getAppContext()` before building the client, surfacing a clear error.
- Confirm `marked` output styling integrates with the editorial `PALETTE`/fonts in
  `digest.tsx` (links use accent color, etc.).
