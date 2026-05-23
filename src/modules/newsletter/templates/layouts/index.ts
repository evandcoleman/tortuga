import type { ReactNode } from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import { ListItems } from './list';
import { GalleryItems } from './gallery';
import { CompactItems } from './compact';
import { MagazineItems } from './magazine';

export interface LayoutItemsProps {
  items: EnrichedItem[];
  theme: Theme;
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

export const DEFAULT_LAYOUT_ID = 'list';

export const LAYOUTS: Record<string, NewsletterLayout> = {
  [listLayout.id]: listLayout,
  [galleryLayout.id]: galleryLayout,
  [compactLayout.id]: compactLayout,
  [magazineLayout.id]: magazineLayout,
};

export function resolveLayout(id?: string | null): NewsletterLayout {
  return (id ? LAYOUTS[id] : undefined) ?? LAYOUTS[DEFAULT_LAYOUT_ID];
}

export const LAYOUT_OPTIONS = Object.values(LAYOUTS).map(l => ({ value: l.id, label: l.label }));
