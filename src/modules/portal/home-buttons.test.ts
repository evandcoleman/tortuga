import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { resolvePortalConfig } from '@/kernel/config/portal';
import { buildHomeButtons } from './home-buttons';

describe('buildHomeButtons', () => {
  it('includes only Getting Started, Rules, Go to Plex, and Report an Issue by default', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const buttons = buildHomeButtons(portal);
    expect(buttons.map((b) => b.label)).toEqual(['Getting Started', 'Rules', 'Go to Plex', 'Report an Issue']);
  });

  it('follows spec order and hides Make a Request / Server Status when unconfigured', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ links: { request_url: 'https://req.example', status_url: 'https://status.example' } }),
    );
    const buttons = buildHomeButtons(portal);
    expect(buttons.map((b) => b.label)).toEqual([
      'Getting Started',
      'Rules',
      'Go to Plex',
      'Make a Request',
      'Server Status',
      'Report an Issue',
    ]);
  });

  it('hides a built-in button when its page is disabled', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({ pages: { getting_started: { enabled: false } } }));
    const buttons = buildHomeButtons(portal);
    expect(buttons.map((b) => b.label)).not.toContain('Getting Started');
  });

  it('appends custom entries after built-ins, in list order', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        custom: [
          { type: 'link', label: 'Wiki', url: 'https://wiki.example' },
          { type: 'page', slug: 'faq', label: 'FAQ', markdown: 'hi' },
        ],
      }),
    );
    const buttons = buildHomeButtons(portal);
    expect(buttons.slice(-2)).toEqual([
      { label: 'Wiki', href: 'https://wiki.example', external: true },
      { label: 'FAQ', href: 'faq', external: false },
    ]);
  });
});
