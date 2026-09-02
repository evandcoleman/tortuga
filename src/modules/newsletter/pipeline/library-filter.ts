import type { EnrichedItem } from '../types';

/**
 * Applies a recipient's per-library preference to a set of items ahead of
 * rendering their digest. `null` means "no filtering" (every library);
 * an array keeps only items whose `libraryName` is in it.
 */
export function filterItemsByLibraries<T extends EnrichedItem>(
  items: T[],
  libraries: string[] | null,
): T[] {
  if (libraries === null) return items;
  const allowed = new Set(libraries);
  return items.filter(it => allowed.has(it.libraryName));
}
