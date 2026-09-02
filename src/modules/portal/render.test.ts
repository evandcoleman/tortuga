import { describe, it, expect } from 'vitest';
import { renderPortalMarkdown, splitLead, addHeadingIds } from './render';
import type { PortalVariables } from './variables';

const vars: PortalVariables = {
  serverName: 'Olympus',
  requestUrl: 'https://req.example',
  requestLabel: 'Overseerr',
  statusUrl: 'https://status.example',
  plexUrl: 'https://app.plex.tv',
};

describe('renderPortalMarkdown', () => {
  it('substitutes variables before rendering markdown', () => {
    const html = renderPortalMarkdown('Welcome to **{{server_name}}**.', vars);
    expect(html).toContain('Welcome to <strong>Olympus</strong>.');
  });

  it('substitutes link targets', () => {
    const html = renderPortalMarkdown('[{{request_label}}]({{request_url}})', vars);
    expect(html).toContain('<a href="https://req.example">Overseerr</a>');
  });

  it('leaves unknown variables literal rather than crashing', () => {
    const html = renderPortalMarkdown('{{not_a_real_var}}', vars);
    expect(html).toContain('{{not_a_real_var}}');
  });
});

describe('splitLead', () => {
  it('pulls out a leading paragraph as the lead', () => {
    const { lead, rest } = splitLead('<p>Intro text.</p><h2>Next</h2><p>Body.</p>');
    expect(lead).toBe('Intro text.');
    expect(rest).toBe('<h2>Next</h2><p>Body.</p>');
  });

  it('preserves inline markup inside the lead', () => {
    const { lead } = splitLead('<p>Hi <strong>there</strong>.</p><p>More.</p>');
    expect(lead).toBe('Hi <strong>there</strong>.');
  });

  it('returns null lead when the body does not start with a paragraph', () => {
    const html = '<h2>Heading</h2><p>Body.</p>';
    const { lead, rest } = splitLead(html);
    expect(lead).toBeNull();
    expect(rest).toBe(html);
  });

  it('returns null lead for empty html', () => {
    const { lead, rest } = splitLead('');
    expect(lead).toBeNull();
    expect(rest).toBe('');
  });

  it('tolerates attributes on the leading <p>', () => {
    const { lead, rest } = splitLead('<p class="x">Intro text.</p><h2>Next</h2>');
    expect(lead).toBe('Intro text.');
    expect(rest).toBe('<h2>Next</h2>');
  });
});

describe('addHeadingIds', () => {
  it('adds slugified ids to h2 headings and builds a matching TOC', () => {
    const html = '<h2>Recommended devices</h2><p>a</p><h2>Here for music?</h2>';
    const { html: out, toc } = addHeadingIds(html);
    expect(out).toContain('<h2 id="recommended-devices">Recommended devices</h2>');
    expect(out).toContain('<h2 id="here-for-music">Here for music?</h2>');
    expect(toc).toEqual([
      { id: 'recommended-devices', text: 'Recommended devices' },
      { id: 'here-for-music', text: 'Here for music?' },
    ]);
  });

  it('de-dupes repeated heading text', () => {
    const html = '<h2>Notes</h2><h2>Notes</h2>';
    const { toc } = addHeadingIds(html);
    expect(toc.map((t) => t.id)).toEqual(['notes', 'notes-1']);
  });

  it('strips inline markup from heading text before slugifying', () => {
    const html = '<h2>Here for <em>music</em>?</h2>';
    const { toc } = addHeadingIds(html);
    expect(toc[0].id).toBe('here-for-music');
    expect(toc[0].text).toBe('Here for music?');
  });

  it('leaves html with no h2s unchanged and returns an empty toc', () => {
    const html = '<p>No headings here.</p>';
    const { html: out, toc } = addHeadingIds(html);
    expect(out).toBe(html);
    expect(toc).toEqual([]);
  });

  it('decodes HTML entities in the TOC text but not in the slugified id', () => {
    const html = "<h2>Foo &amp; Bar&#39;s</h2>";
    const { toc } = addHeadingIds(html);
    expect(toc[0].text).toBe("Foo & Bar's");
    expect(toc[0].id).toBe('foo-amp-bar-39-s');
  });

  it('leaves out-of-range numeric character references untouched instead of throwing', () => {
    const html = '<h2>Bad &#99999999999; and &#x110000; refs</h2>';
    expect(() => addHeadingIds(html)).not.toThrow();
    const { toc } = addHeadingIds(html);
    expect(toc[0].text).toBe('Bad &#99999999999; and &#x110000; refs');
  });
});
