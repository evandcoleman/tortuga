// scripts/render-matrix.mts
// Usage: npx tsx scripts/render-matrix.mts
// Dumps every theme × layout combination to tmp/newsletter-matrix/*.html
import { mkdir, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { render } from '@react-email/render';
// tsx transforms these CJS-interop modules; import via default to get named exports
import digestMod from '../src/modules/newsletter/templates/digest.tsx';
import themesMod from '../src/modules/newsletter/templates/themes.ts';
import layoutsMod from '../src/modules/newsletter/templates/layouts/index.ts';
import type { EnrichedItem } from '../src/modules/newsletter/types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DigestEmail } = digestMod as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { THEMES } = themesMod as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { LAYOUTS } = layoutsMod as any;

const items: EnrichedItem[] = [
  {
    guid: 'g1', title: 'Dune: Part Two', mediaType: 'movie', libraryName: 'Movies',
    addedAt: new Date('2026-05-01T00:00:00Z'), rating: 8.4, year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    overview: 'Paul Atreides unites with the Fremen to wage war against House Harkonnen.',
    plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=1',
  },
  {
    guid: 'g2', title: 'The Substance', mediaType: 'movie', libraryName: 'Movies',
    addedAt: new Date('2026-05-02T00:00:00Z'), rating: 7.2, year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w500/lqoMzCcZYEFK729d6qzt349fB4o.jpg',
    overview: 'A fading celebrity uses a black-market drug to create a younger version of herself.',
    plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=2',
  },
  {
    guid: 'g3', title: 'Severance', mediaType: 'season', showTitle: 'Severance',
    libraryName: 'TV', addedAt: new Date('2026-05-03T00:00:00Z'), rating: 8.7,
    seasonNumber: 2, episodeCount: 10,
    posterUrl: 'https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg',
    overview: 'Mark and his colleagues uncover the truth behind their severed work lives.',
    plexUrl: 'https://app.plex.tv/desktop/#!/server/abc/details?key=3',
  },
];

const baseProps = {
  items,
  unsubscribeUrl: 'https://example.com/u',
  appName: 'Tortuga',
  windowStart: new Date('2026-05-01T00:00:00Z'),
  windowEnd: new Date('2026-05-08T00:00:00Z'),
  intro: 'A strong week of cinema and a long-awaited return to the office.',
};

const outDir = 'tmp/newsletter-matrix';
await mkdir(outDir, { recursive: true });

for (const theme of Object.values(THEMES)) {
  for (const lay of Object.values(LAYOUTS)) {
    const html = await render(
      createElement(DigestEmail, { ...baseProps, themeId: (theme as any).id, layoutId: (lay as any).id }),
    );
    const file = `${outDir}/${(theme as any).id}__${(lay as any).id}.html`;
    await writeFile(file, html, 'utf8');
    console.log(`wrote ${file}`);
  }
}
console.log(`\nDone — ${Object.keys(THEMES).length * Object.keys(LAYOUTS).length} combos in ${outDir}/`);
