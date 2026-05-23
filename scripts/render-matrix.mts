// scripts/render-matrix.mts
// Usage: npx tsx scripts/render-matrix.mts
// Dumps every theme × layout combination to tmp/newsletter-matrix/*.html
import { mkdir, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { render } from '@react-email/render';
// tsx transpiles these modules to CJS, so under Node's ESM loader their named
// exports arrive on the default binding. Import default, then destructure.
// (scripts/ is excluded from the app tsconfig — this runs via `npx tsx`.)
import digestMod from '../src/modules/newsletter/templates/digest';
import themesMod from '../src/modules/newsletter/templates/themes';
import layoutsMod from '../src/modules/newsletter/templates/layouts';
import type { EnrichedItem } from '../src/modules/newsletter/types';

const { DigestEmail } = digestMod;
const { THEMES } = themesMod;
const { LAYOUTS } = layoutsMod;

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
    seasonNumber: 2, episodeCount: 3, episodeNumbers: [5, 6, 7],
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
      createElement(DigestEmail, { ...baseProps, themeId: theme.id, layoutId: lay.id }),
    );
    const file = `${outDir}/${theme.id}__${lay.id}.html`;
    await writeFile(file, html, 'utf8');
    console.log(`wrote ${file}`);
  }
}
console.log(`\nDone — ${Object.keys(THEMES).length * Object.keys(LAYOUTS).length} combos in ${outDir}/`);
