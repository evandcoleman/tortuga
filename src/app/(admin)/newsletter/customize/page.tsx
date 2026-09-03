import { getAppContext } from '@/kernel/context';
import { itemsCache } from '@/modules/newsletter/schema';
import type { EnrichedItem } from '@/modules/newsletter/types';
import type { Appearance } from '@/modules/newsletter/appearance/schema';
import { Card, PageHeader } from '../../_components/ui';
import { CustomizeEditor } from './CustomizeEditor';

export const dynamic = 'force-dynamic';

const MAX_CACHE_ROWS = 500;

function deriveKnownLibraries(payloads: string[]): string[] {
  const libraries = new Set<string>();
  for (const raw of payloads) {
    try {
      const item = JSON.parse(raw) as EnrichedItem;
      const name = typeof item.libraryName === 'string' ? item.libraryName.trim() : '';
      if (name) libraries.add(name);
    } catch {
      // Skip rows with unparsable payloads; an empty list is acceptable.
    }
  }
  return Array.from(libraries).sort((a, b) => a.localeCompare(b));
}

export default function CustomizePage() {
  const ctx = getAppContext();

  const theme = ctx.config.newsletter.theme;
  const layout = ctx.config.newsletter.layout;
  const appearance: Appearance = ctx.config.newsletter.appearance ?? {};

  const cachedRows = ctx.db
    .select({ payload: itemsCache.payload })
    .from(itemsCache)
    .limit(MAX_CACHE_ROWS)
    .all();
  const knownLibraries = deriveKnownLibraries(cachedRows.map(r => r.payload));

  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Customize appearance"
      />
      <Card>
        <CustomizeEditor
          appearance={appearance}
          theme={theme}
          layout={layout}
          knownLibraries={knownLibraries}
        />
      </Card>
    </div>
  );
}
