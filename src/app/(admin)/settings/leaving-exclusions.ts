/**
 * Stored `leaving.excluded_collection_ids` that no longer appear in the
 * rendered checklist (e.g. the collection was deleted in Maintainerr, or the
 * live fetch temporarily omitted it). These need a hidden input alongside the
 * checkbox list so saving the form never silently drops the exclusion.
 */
export function missingExcludedIds(storedIds: number[], renderedIds: number[]): number[] {
  const rendered = new Set(renderedIds);
  return storedIds.filter(id => !rendered.has(id));
}
