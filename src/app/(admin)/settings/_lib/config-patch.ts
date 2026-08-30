import { NewsletterConfigSchema, type NewsletterConfig } from '@/kernel/config/schema';

export type ParseResult =
  | { ok: true; config: NewsletterConfig }
  | { ok: false; errors: Record<string, string> };

/**
 * Merges a page's partial patch onto the current full config and validates the
 * result against the whole-object schema. Every settings sub-page only touches
 * its own top-level keys; every other key round-trips unchanged from `current`
 * so saving one page can never drop another page's settings.
 */
export function mergeAndValidate(
  current: NewsletterConfig,
  patch: Partial<Record<keyof NewsletterConfig, unknown>>,
): ParseResult {
  const candidate = { ...current, ...patch };
  const parsed = NewsletterConfigSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, config: parsed.data };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return { ok: false, errors };
}
