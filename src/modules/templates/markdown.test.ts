import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings and paragraphs to HTML', () => {
    const html = renderMarkdown('## Hi\n\nHello **world**.');
    expect(html).toContain('<h2>Hi</h2>');
    expect(html).toContain('<strong>world</strong>');
  });

  it('renders links', () => {
    const html = renderMarkdown('[Plex](https://app.plex.tv)');
    expect(html).toContain('<a href="https://app.plex.tv">Plex</a>');
  });
});
