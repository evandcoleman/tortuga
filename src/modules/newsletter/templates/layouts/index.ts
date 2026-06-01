import type { ReactNode } from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { ResolvedItemDisplay } from '../../appearance/resolve';
import { ListItems } from './list';
import { GalleryItems } from './gallery';
import { CompactItems } from './compact';
import { MagazineItems } from './magazine';
import { SpotlightItems } from './spotlight';
import { TimelineItems } from './timeline';
import { LedgerItems } from './ledger';
import { IndexTocItems } from './index-toc';

export { posterScaleFactor } from '../../appearance/resolve';
export type { ResolvedItemDisplay } from '../../appearance/resolve';

export interface LayoutItemsProps {
  items: EnrichedItem[];
  theme: Theme;
  itemDisplay?: ResolvedItemDisplay;
}

export interface NewsletterLayout {
  id: string;
  label: string;
  Items: (props: LayoutItemsProps) => ReactNode;
}

export const listLayout: NewsletterLayout = { id: 'list', label: 'List', Items: ListItems };
export const galleryLayout: NewsletterLayout = { id: 'gallery', label: 'Gallery', Items: GalleryItems };
export const compactLayout: NewsletterLayout = { id: 'compact', label: 'Compact', Items: CompactItems };
export const magazineLayout: NewsletterLayout = { id: 'magazine', label: 'Magazine', Items: MagazineItems };
export const spotlightLayout: NewsletterLayout = { id: 'spotlight', label: 'Spotlight', Items: SpotlightItems };
export const timelineLayout: NewsletterLayout = { id: 'timeline', label: 'Timeline', Items: TimelineItems };
export const ledgerLayout: NewsletterLayout = { id: 'ledger', label: 'Ledger', Items: LedgerItems };
export const indexTocLayout: NewsletterLayout = { id: 'index-toc', label: 'Index / TOC', Items: IndexTocItems };

export const DEFAULT_LAYOUT_ID = 'list';

export const LAYOUTS: Record<string, NewsletterLayout> = {
  [listLayout.id]: listLayout,
  [galleryLayout.id]: galleryLayout,
  [compactLayout.id]: compactLayout,
  [magazineLayout.id]: magazineLayout,
  [spotlightLayout.id]: spotlightLayout,
  [timelineLayout.id]: timelineLayout,
  [ledgerLayout.id]: ledgerLayout,
  [indexTocLayout.id]: indexTocLayout,
};

export function resolveLayout(id?: string | null): NewsletterLayout {
  return (id ? LAYOUTS[id] : undefined) ?? LAYOUTS[DEFAULT_LAYOUT_ID];
}

export const LAYOUT_OPTIONS = Object.values(LAYOUTS).map(l => ({ value: l.id, label: l.label }));
