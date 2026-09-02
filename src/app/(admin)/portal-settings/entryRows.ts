import type { PortalEntry } from '@/kernel/config/schema';

/**
 * A home-index entry paired with a stable identity for list rendering/reordering.
 * Built-ins get a deterministic id derived from their target (`builtin_page:<page>`,
 * `builtin_link:<link>`) since there's at most one row per target; custom `link`/`page`
 * rows get a generated id, assigned once when the row is created or loaded and kept in
 * form state alongside the entry. The id never round-trips to `PortalConfig` — it's
 * stripped before validation/save (see `toEntries`).
 */
export interface IndexEntryRowState {
  id: string;
  entry: PortalEntry;
}

/** Stable identity for an entry row — deterministic for built-ins, freshly generated for custom rows. */
export function makeEntryRowId(entry: PortalEntry): string {
  if (entry.type === 'builtin_page') return `builtin_page:${entry.page}`;
  if (entry.type === 'builtin_link') return `builtin_link:${entry.link}`;
  return crypto.randomUUID();
}

/** Wraps a freshly loaded/derived entry list in row state, assigning each row's id once. */
export function toEntryRows(entries: PortalEntry[]): IndexEntryRowState[] {
  return entries.map((entry) => ({ id: makeEntryRowId(entry), entry }));
}

/** Strips row ids back down to the plain entry list `PortalConfig` expects. */
export function toEntries(rows: IndexEntryRowState[]): PortalEntry[] {
  return rows.map((row) => row.entry);
}
