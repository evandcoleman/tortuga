import { NewsletterConfigSchema, type NewsletterConfig } from '@/kernel/config/schema';

export type ParseResult =
  | { ok: true; config: NewsletterConfig }
  | { ok: false; errors: Record<string, string> };

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === 'on';
}
function num(fd: FormData, key: string): number {
  return Number(str(fd, key));
}
function list(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);
}
function opt(value: string): string | undefined {
  return value === '' ? undefined : value;
}

export function parseNewsletterForm(fd: FormData): ParseResult {
  const provider = str(fd, 'email.provider') === 'mailgun' ? 'mailgun' : 'resend';
  const includeRaw = list(fd, 'include_libraries');

  const extrasFields = {
    request_url: opt(str(fd, 'extras.request_url')),
    request_label: str(fd, 'extras.request_label'),
    personal_url: opt(str(fd, 'extras.personal_url')),
    personal_label: opt(str(fd, 'extras.personal_label')),
    freeform_markdown: opt(str(fd, 'extras.freeform_markdown')),
  };
  const hasExtras =
    extrasFields.request_url !== undefined ||
    extrasFields.personal_url !== undefined ||
    extrasFields.personal_label !== undefined ||
    extrasFields.freeform_markdown !== undefined ||
    (extrasFields.request_label !== '' && extrasFields.request_label !== 'Request a title');

  const candidate = {
    schedule: str(fd, 'schedule'),
    schedule_enabled: bool(fd, 'schedule_enabled'),
    timezone: str(fd, 'timezone'),
    lookback_days: num(fd, 'lookback_days'),
    email: {
      provider,
      ...(provider === 'mailgun'
        ? {
            mailgun: {
              domain: str(fd, 'email.mailgun.domain'),
              region: str(fd, 'email.mailgun.region') === 'eu' ? ('eu' as const) : ('us' as const),
            },
          }
        : {}),
    },
    from: { email: str(fd, 'from.email'), name: str(fd, 'from.name') },
    reply_to: opt(str(fd, 'reply_to')),
    include_libraries: includeRaw.length ? includeRaw : null,
    filters: {
      min_tmdb_rating: num(fd, 'filters.min_tmdb_rating'),
      dedupe_episodes_into_seasons: bool(fd, 'filters.dedupe_episodes_into_seasons'),
      max_items_per_section: num(fd, 'filters.max_items_per_section'),
      exclude_genres: list(fd, 'filters.exclude_genres'),
    },
    featured: { enabled: bool(fd, 'featured.enabled') },
    ...(str(fd, 'plex.server_id') ? { plex: { server_id: str(fd, 'plex.server_id') } } : {}),
    commentary: {
      enabled: bool(fd, 'commentary.enabled'),
      provider: str(fd, 'commentary.provider') === 'openai' ? ('openai' as const) : ('anthropic' as const),
      model: str(fd, 'commentary.model'),
      voice: str(fd, 'commentary.voice'),
      disclaimer: bool(fd, 'commentary.disclaimer'),
    },
    ...(hasExtras ? { extras: extrasFields } : {}),
  };

  const parsed = NewsletterConfigSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, config: parsed.data };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return { ok: false, errors };
}
