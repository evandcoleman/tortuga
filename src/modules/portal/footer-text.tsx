import type { ReactNode } from 'react';
import { TORTUGA_REPO_URL } from './constants';

const TORTUGA_WORD = 'Tortuga';

/**
 * Renders admin-editable footer copy, turning every case-sensitive
 * occurrence of the word "Tortuga" into a link to the project repo. Text
 * without the word is returned unchanged.
 */
export function renderFooterText(text: string): ReactNode {
  const parts = text.split(TORTUGA_WORD);
  if (parts.length === 1) return text;

  return parts.flatMap((part, index) => {
    const isLast = index === parts.length - 1;
    const link = isLast ? [] : [
      <a
        key={`tortuga-link-${index}`}
        href={TORTUGA_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Tortuga on GitHub (opens in new tab)"
        className="underline decoration-dotted underline-offset-2 hover:opacity-80"
      >
        {TORTUGA_WORD}
      </a>,
    ];
    return [part, ...link];
  });
}
