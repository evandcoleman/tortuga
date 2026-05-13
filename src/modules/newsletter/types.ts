export interface EnrichedItem {
  guid: string;
  title: string;
  mediaType: 'movie' | 'show' | 'episode' | 'season' | string;
  libraryName: string;
  addedAt: Date;
  year?: number;
  rating: number;
  posterUrl: string | null;
  overview: string;
  showTitle?: string;
  seasonNumber?: number;
  episodeCount?: number;
  genres?: string[];
}
