import type { MaintainerrClient, MaintainerrCollection } from '@/kernel/integrations/maintainerr';
import type { TautulliClient, TautulliItem } from '@/kernel/integrations/tautulli';
import type { Logger } from '@/kernel/logging/logger';
import { mapWithConcurrency } from '@/kernel/util/concurrency';

const METADATA_CONCURRENCY = 4;
const MAINTAINERR_CONCURRENCY = 4;
export const MAINTAINERR_TIMEOUT_MS = 10_000;

export interface FetchLeavingDeps {
  maintainerr: MaintainerrClient;
  tautulli: TautulliClient;
  log: Logger;
}

export interface FetchLeavingArgs {
  windowEnd: Date;
  days: number;
  excludedCollectionIds: number[];
  /** Injectable for tests; defaults to a fresh 10s timeout signal per call. */
  signal?: AbortSignal;
}

/** deleteAfterDays is a fixed day count added to addDate, not a timezone-aware calendar add. */
export function computeLeavesAt(addDate: string, deleteAfterDays: number): Date {
  return new Date(new Date(addDate).getTime() + deleteAfterDays * 86_400_000);
}

export function isCollectionEligible(
  collection: MaintainerrCollection,
  excludedCollectionIds: number[],
): collection is MaintainerrCollection & { deleteAfterDays: number } {
  if (collection.deleteAfterDays === null || collection.deleteAfterDays <= 0) return false;
  return !excludedCollectionIds.includes(collection.id);
}

/** windowEnd < leavesAt <= windowEnd + days */
export function isWithinLeavingWindow(leavesAt: Date, windowEnd: Date, days: number): boolean {
  const upperBound = windowEnd.getTime() + days * 86_400_000;
  return leavesAt.getTime() > windowEnd.getTime() && leavesAt.getTime() <= upperBound;
}

interface DedupeEntry {
  mediaServerId: string;
  leavesAt: Date;
}

export function dedupeByMediaServerId<T extends DedupeEntry>(entries: T[]): T[] {
  const byId = new Map<string, T>();
  for (const entry of entries) {
    const existing = byId.get(entry.mediaServerId);
    if (!existing || entry.leavesAt.getTime() < existing.leavesAt.getTime()) {
      byId.set(entry.mediaServerId, entry);
    }
  }
  return [...byId.values()];
}

export async function fetchLeavingItems(deps: FetchLeavingDeps, args: FetchLeavingArgs): Promise<TautulliItem[]> {
  const { windowEnd, days, excludedCollectionIds } = args;
  const signal = args.signal ?? AbortSignal.timeout(MAINTAINERR_TIMEOUT_MS);

  const collections = await deps.maintainerr.getCollections(signal);
  const eligibleCollections = collections.filter(c => isCollectionEligible(c, excludedCollectionIds));

  const mediaLists = await mapWithConcurrency(
    eligibleCollections,
    MAINTAINERR_CONCURRENCY,
    c => deps.maintainerr.getCollectionMedia(c.id, signal),
  );

  const candidates = eligibleCollections.flatMap((collection, i) =>
    mediaLists[i].map(media => ({
      mediaServerId: media.mediaServerId,
      leavesAt: computeLeavesAt(media.addDate, collection.deleteAfterDays),
    })),
  );

  const inWindow = candidates.filter(c => isWithinLeavingWindow(c.leavesAt, windowEnd, days));
  const deduped = dedupeByMediaServerId(inWindow);

  const results = await mapWithConcurrency(deduped, METADATA_CONCURRENCY, async ({ mediaServerId, leavesAt }) => {
    try {
      const item = await deps.tautulli.getMetadata(mediaServerId);
      return { ...item, leavesAt };
    } catch (err) {
      deps.log.warn({ err, mediaServerId }, 'leaving: metadata lookup failed, dropping item');
      return undefined;
    }
  });
  const items = results.filter((v): v is NonNullable<typeof v> => v !== undefined);

  return items.sort((a, b) => (a.leavesAt?.getTime() ?? 0) - (b.leavesAt?.getTime() ?? 0));
}
