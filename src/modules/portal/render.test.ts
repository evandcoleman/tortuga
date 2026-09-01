import { describe, it, expect } from 'vitest';
import { renderPortalMarkdown } from './render';
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
