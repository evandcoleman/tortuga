import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderFooterText } from './footer-text';
import { TORTUGA_REPO_URL } from './constants';

function toHtml(text: string): string {
  return renderToStaticMarkup(<>{renderFooterText(text)}</>);
}

describe('renderFooterText', () => {
  it('links the word "Tortuga" in the default copy', () => {
    const html = toHtml('Powered by Tortuga');
    expect(html).toContain(`href="${TORTUGA_REPO_URL}"`);
    expect(html).toContain('>Tortuga</a>');
    expect(html).toContain('Powered by');
  });

  it('returns text unchanged when the word is absent', () => {
    const html = toHtml('Powered by nothing');
    expect(html).not.toContain('<a');
    expect(html).toBe('Powered by nothing');
  });

  it('links every occurrence when the word appears more than once', () => {
    const html = toHtml('Tortuga loves Tortuga');
    const matches = html.match(/<a /g) ?? [];
    expect(matches).toHaveLength(2);
    expect(html).toContain(' loves ');
  });

  it('is case-sensitive and does not link lowercase "tortuga"', () => {
    const html = toHtml('powered by tortuga');
    expect(html).not.toContain('<a');
    expect(html).toBe('powered by tortuga');
  });

  it('opens the link in a new tab with safe rel attributes', () => {
    const html = toHtml('Tortuga');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
