import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalContentPage } from './portal-content-page';

const baseProps = {
  title: 'House Rules',
  eyebrow: 'Rules',
  html: '<p>Intro.</p><h2>Section one</h2><p>Body.</p>',
  serverName: 'Orpheus',
  homeHref: '/',
  tocHeading: 'On this page',
  backLabel: 'Back to index',
  stuckCard: null,
};

describe('PortalContentPage', () => {
  it('renders the configured title, eyebrow, and back label', () => {
    const html = renderToStaticMarkup(<PortalContentPage {...baseProps} />);
    expect(html).toContain('House Rules');
    expect(html).toContain('Rules');
    expect(html).toContain('Back to index');
  });

  it('renders a custom back label', () => {
    const html = renderToStaticMarkup(<PortalContentPage {...baseProps} backLabel="Home" />);
    expect(html).toContain('Home');
    expect(html).not.toContain('Back to index');
  });

  it('renders a custom TOC heading when there are headings', () => {
    const html = renderToStaticMarkup(<PortalContentPage {...baseProps} tocHeading="Contents" />);
    expect(html).toContain('Contents');
  });

  it('renders the stuck card title/body/link label when provided', () => {
    const html = renderToStaticMarkup(
      <PortalContentPage
        {...baseProps}
        stuckCard={{ title: 'Need help?', body: 'Ask us anything.', linkLabel: 'Get help', href: '/report-issue' }}
      />,
    );
    expect(html).toContain('Need help?');
    expect(html).toContain('Ask us anything.');
    expect(html).toContain('Get help');
  });

  it('omits the stuck card entirely when null', () => {
    const html = renderToStaticMarkup(<PortalContentPage {...baseProps} stuckCard={null} />);
    expect(html).not.toContain('Stuck?');
    expect(html).not.toContain('Report an issue');
  });

  it('escapes HTML in the title instead of injecting it', () => {
    const html = renderToStaticMarkup(<PortalContentPage {...baseProps} title="<b>Rules</b>" />);
    expect(html).not.toContain('<b>Rules</b>');
    expect(html).toContain('&lt;b&gt;Rules&lt;/b&gt;');
  });
});
