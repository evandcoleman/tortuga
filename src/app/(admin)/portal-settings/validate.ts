import { PortalConfigSchema, type PortalConfig } from '@/kernel/config/schema';

export type ValidateResult =
  | { ok: true; config: PortalConfig }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a full candidate `PortalConfig` (the portal settings page owns the
 * entire `portal` section — unlike the newsletter settings pages there's no
 * other page to round-trip untouched keys from, so this validates the whole
 * object directly rather than merging a partial patch).
 */
export function validatePortalConfig(candidate: unknown): ValidateResult {
  const parsed = PortalConfigSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, config: parsed.data };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return { ok: false, errors };
}
