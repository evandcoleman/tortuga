import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { resolvePortalConfig } from '@/kernel/config/portal';
import { buildHomeButtons } from './home-buttons';

const SERVER_NAME = 'Orpheus';

describe('buildHomeButtons', () => {
  it('includes only Getting started, House rules, Open Plex, and Report an issue by default', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const buttons = buildHomeButtons(portal, SERVER_NAME);
    expect(buttons.map((b) => b.label)).toEqual(['Getting started', 'House rules', 'Open Plex', 'Report an issue']);
  });

  it('follows spec order and hides Make a request / Server status when unconfigured', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ links: { request_url: 'https://req.example', status_url: 'https://status.example' } }),
    );
    const buttons = buildHomeButtons(portal, SERVER_NAME);
    expect(buttons.map((b) => b.label)).toEqual([
      'Getting started',
      'House rules',
      'Open Plex',
      'Make a request',
      'Server status',
      'Report an issue',
    ]);
  });

  it('hides a built-in button when its page is disabled', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({ pages: { getting_started: { enabled: false } } }));
    const buttons = buildHomeButtons(portal, SERVER_NAME);
    expect(buttons.map((b) => b.label)).not.toContain('Getting started');
  });

  it('appends custom entries after built-ins, in list order, carrying their description', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        custom: [
          { type: 'link', label: 'Wiki', url: 'https://wiki.example', description: 'Community-run wiki.' },
          { type: 'page', slug: 'faq', label: 'FAQ', markdown: 'hi' },
        ],
      }),
    );
    const buttons = buildHomeButtons(portal, SERVER_NAME);
    expect(buttons.slice(-2)).toEqual([
      { label: 'Wiki', href: 'https://wiki.example', external: true, description: 'Community-run wiki.' },
      { label: 'FAQ', href: 'faq', external: false, description: undefined },
    ]);
  });

  it('interpolates the server name into built-in descriptions', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const buttons = buildHomeButtons(portal, SERVER_NAME);
    const gettingStarted = buttons.find((b) => b.label === 'Getting started');
    expect(gettingStarted?.description).toContain('Orpheus');
  });

  it('gives every built-in button a description', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ links: { request_url: 'https://req.example', status_url: 'https://status.example' } }),
    );
    const buttons = buildHomeButtons(portal, SERVER_NAME);
    expect(buttons.every((b) => Boolean(b.description))).toBe(true);
  });
});
