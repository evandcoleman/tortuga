import { describe, it, expect } from 'vitest';
import { renderPortalMarkdown } from './render';
import { GETTING_STARTED_MARKDOWN, RULES_MARKDOWN, REPORT_ISSUE_MARKDOWN } from './copy';
import type { PortalVariables } from './variables';

const vars: PortalVariables = {
  serverName: 'Olympus',
  requestUrl: 'https://req.example',
  requestLabel: 'Overseerr',
  statusUrl: 'https://status.example',
  plexUrl: 'https://app.plex.tv',
};

describe('default portal copy', () => {
  it('getting-started substitutes {{server_name}} and covers the invite -> install -> pick -> stream flow', () => {
    const html = renderPortalMarkdown(GETTING_STARTED_MARKDOWN, vars);
    expect(html).toContain('Olympus');
    expect(html).not.toContain('{{server_name}}');
    expect(html.toLowerCase()).toContain('recommended devices');
    expect(html.toLowerCase()).toContain('plexamp');
  });

  it('rules substitutes {{server_name}} and stays generic house rules', () => {
    const html = renderPortalMarkdown(RULES_MARKDOWN, vars);
    expect(html).toContain('Olympus');
    expect(html.toLowerCase()).toContain('household');
    expect(html.toLowerCase()).toContain('request');
  });

  it('report-issue links through {{request_label}} at {{request_url}}', () => {
    const html = renderPortalMarkdown(REPORT_ISSUE_MARKDOWN, vars);
    expect(html).toContain('<a href="https://req.example">Overseerr</a>');
    expect(html).not.toContain('{{request_url}}');
  });

  it('report-issue renders without a broken link when request_url/label are unset', () => {
    const html = renderPortalMarkdown(REPORT_ISSUE_MARKDOWN, {
      ...vars,
      requestUrl: '#',
      requestLabel: 'the request service',
    });
    expect(html).toContain('<a href="#">the request service</a>');
  });
});
