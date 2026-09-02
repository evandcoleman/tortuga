import { PortalConfigSchema, type PortalConfig, type PortalEntry } from '@/kernel/config/schema';
import { DEFAULT_PORTAL_ENTRIES } from '@/modules/portal/copy';

export type ValidateResult =
  | { ok: true; config: PortalConfig }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a full candidate `PortalConfig` (the portal settings page owns the
 * entire `portal` section — unlike the newsletter settings pages there's no
 * other page to round-trip untouched keys from, so this validates the whole
 * object directly rather than merging a partial patch). The form already
 * builds its working state in `PortalConfig` shape (blank optional fields are
 * set to `undefined` as the user clears them), so no separate form→config
 * transform is needed here — this is the single point where that shape is
 * checked against the schema, surfacing entry/page/copy issues (including
 * duplicate built-ins and the markdown-xor-html rule) as field errors the
 * same way every other field already does.
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

/**
 * Computes the admin form's initial `entries` list, per
 * docs/specs/2026-09-01-portal-copy-and-index.md §1: the config's `entries`
 * if it has one, else the default six built-ins followed by any legacy
 * `custom` entries. The form always writes `entries` back (never `custom`) on
 * save, so this legacy-merge only ever needs to run once, on load.
 *
 * Mirrors `buildRawEntries` in `src/kernel/config/portal.ts` — duplicated
 * rather than imported because that module pulls in server-only resolution
 * code (token substitution, links resolution) this client form doesn't need.
 */
export function deriveInitialEntries(config: Pick<PortalConfig, 'entries' | 'custom'>): PortalEntry[] {
  return config.entries ?? [...DEFAULT_PORTAL_ENTRIES, ...config.custom];
}
