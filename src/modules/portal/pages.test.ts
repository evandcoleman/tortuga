import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { resolvePortalConfig } from '@/kernel/config/portal';
import { getBuiltinPortalPage, getCustomPortalPage } from './pages';
import type { PortalVariables } from './variables';

const vars: PortalVariables = {
  serverName: 'Olympus',
  requestUrl: 'https://req.example',
  requestLabel: 'Overseerr',
  statusUrl: 'https://status.example',
  plexUrl: 'https://app.plex.tv',
};

describe('getBuiltinPortalPage', () => {
  it('renders the default copy with variables substituted', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const page = getBuiltinPortalPage('getting_started', portal, vars);
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Getting Started');
    expect(page!.html).toContain('Olympus');
  });

  it('returns null (404) when the page is disabled', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ pages: { rules: { enabled: false } } }),
    );
    expect(getBuiltinPortalPage('rules', portal, vars)).toBeNull();
  });

  it('a configured markdown override replaces the default body entirely', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ pages: { rules: { markdown: 'Custom rules for {{server_name}}.' } } }),
    );
    const page = getBuiltinPortalPage('rules', portal, vars);
    expect(page!.html).toContain('Custom rules for Olympus.');
    expect(page!.html.toLowerCase()).not.toContain('household');
  });
});

describe('getCustomPortalPage', () => {
  it('renders a markdown custom page through substitution + markdown', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        custom: [{ type: 'page', slug: 'faq', label: 'FAQ', markdown: 'Hi from {{server_name}}.' }],
      }),
    );
    const page = getCustomPortalPage(portal, 'faq', vars);
    expect(page).not.toBeNull();
    expect(page!.title).toBe('FAQ');
    expect(page!.html).toContain('Hi from Olympus.');
  });

  it('renders an html custom page verbatim, with no substitution', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        custom: [{ type: 'page', slug: 'faq', label: 'FAQ', html: '<p>Raw {{server_name}}</p>' }],
      }),
    );
    const page = getCustomPortalPage(portal, 'faq', vars);
    expect(page!.html).toBe('<p>Raw {{server_name}}</p>');
  });

  it('returns null for an unknown slug', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    expect(getCustomPortalPage(portal, 'nope', vars)).toBeNull();
  });

  it('returns null for a link-type entry slug lookup (links have no slug/page)', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ custom: [{ type: 'link', label: 'Wiki', url: 'https://wiki.example' }] }),
    );
    expect(getCustomPortalPage(portal, 'wiki', vars)).toBeNull();
  });
});
