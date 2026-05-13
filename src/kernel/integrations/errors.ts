export class IntegrationError extends Error {
  constructor(
    public readonly source: 'tautulli' | 'tmdb' | 'resend',
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
export class ResendError extends IntegrationError {
  constructor(m: string, s?: number, r = false, c?: unknown) { super('resend', m, s, r, c); }
}
