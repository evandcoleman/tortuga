import type { NewsletterConfig } from '@/kernel/config/schema';
import { DEFAULT_REQUEST_LABEL } from '@/kernel/config/schema';
import { mergeAndValidate, type ParseResult } from '../_lib/config-patch';
import { str, bool, num, optNum, list, opt, numList } from '../_lib/form-values';

export function parseContentForm(fd: FormData, current: NewsletterConfig): ParseResult {
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
    (extrasFields.request_label !== '' && extrasFields.request_label !== DEFAULT_REQUEST_LABEL);

  return mergeAndValidate(current, {
    include_libraries: includeRaw.length ? includeRaw : null,
    filters: {
      min_tmdb_rating: num(fd, 'filters.min_tmdb_rating'),
      dedupe_episodes_into_seasons: bool(fd, 'filters.dedupe_episodes_into_seasons'),
      max_items_per_section: num(fd, 'filters.max_items_per_section'),
      max_items_leaving_soon: optNum(fd, 'filters.max_items_leaving_soon'),
      exclude_genres: list(fd, 'filters.exclude_genres'),
    },
    commentary: {
      enabled: bool(fd, 'commentary.enabled'),
      provider: str(fd, 'commentary.provider') === 'openai' ? ('openai' as const) : ('anthropic' as const),
      model: str(fd, 'commentary.model'),
      voice: str(fd, 'commentary.voice'),
      disclaimer: bool(fd, 'commentary.disclaimer'),
    },
    extras: hasExtras ? extrasFields : undefined,
    // `leaving.days` is always present in the real form (either editable or as a
    // hidden round-trip value), so its presence signals the whole group was
    // submitted. Omitting the key entirely (rather than parsing zeros) lets the
    // schema's defaults apply for callers — like older tests — that don't send it.
    ...(fd.has('leaving.days')
      ? {
          leaving: {
            enabled: bool(fd, 'leaving.enabled'),
            days: num(fd, 'leaving.days'),
            excluded_collection_ids: numList(fd, 'leaving.excluded_collection_ids'),
            heading: str(fd, 'leaving.heading') || 'Leaving soon',
          },
        }
      : {}),
  });
}
