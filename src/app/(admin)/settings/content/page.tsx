import { getAppContext } from '@/kernel/context';
import { ContentForm, type LeavingCollectionsResult } from './ContentForm';

export const dynamic = 'force-dynamic';

// Collections are fetched live so the exclusion checklist always reflects
// Maintainerr's current state; a fetch failure never blocks the settings page
// or the ability to save the rest of the form (see ContentForm).
async function loadLeavingCollections(
  maintainerr: ReturnType<typeof getAppContext>['maintainerr'],
): Promise<LeavingCollectionsResult | null> {
  if (!maintainerr) return null;
  try {
    const collections = await maintainerr.getCollections(AbortSignal.timeout(3000));
    return { ok: true, collections: collections.filter(c => (c.deleteAfterDays ?? 0) > 0) };
  } catch {
    return { ok: false };
  }
}

export default async function ContentSettingsPage() {
  const ctx = getAppContext();
  const leavingCollections = await loadLeavingCollections(ctx.maintainerr);

  return <ContentForm config={ctx.config.newsletter} leavingCollections={leavingCollections} />;
}
