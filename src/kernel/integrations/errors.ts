export class IntegrationError extends Error {
  constructor(
    public readonly source: 'tautulli' | 'tmdb' | 'resend' | 'anthropic' | 'openai' | 'maintainerr' | 'plex',
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'IntegrationError';
  }
}
export class TautulliError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('tautulli', m, s, r, c); }
}
export class TmdbError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('tmdb', m, s, r, c); }
}
export class MaintainerrError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('maintainerr', m, s, r, c); }
}
export class PlexError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('plex', m, s, r, c); }
}
export class ResendError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('resend', m, s, r, c); }
}
export class LlmError extends IntegrationError {
  constructor(source: 'anthropic' | 'openai', m: string, s?: number, r = false, c?: unknown) {
    super(source, m, s, r, c);
  }
}
