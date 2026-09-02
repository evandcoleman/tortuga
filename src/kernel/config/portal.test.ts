import { describe, it, expect } from 'vitest';
import { resolvePortalConfig } from './portal';
import { PortalConfigSchema } from './schema';
import { buildHomeButtons } from '@/modules/portal/home-buttons';

const SERVER_NAME = 'Orpheus';

describe('resolvePortalConfig', () => {
  it('defaults plex_url and leaves request fields unset when no extras and no explicit links', () => {
    const portal = PortalConfigSchema.parse({});
    const resolved = resolvePortalConfig(portal);
    expect(resolved.links.plexUrl).toBe('https://app.plex.tv');
    expect(resolved.links.requestUrl).toBeUndefined();
    expect(resolved.links.requestLabel).toBeUndefined();
    expect(resolved.links.statusUrl).toBeUndefined();
  });

  it('falls back request_url/request_label from newsletter extras when portal links unset', () => {
    const portal = PortalConfigSchema.parse({});
    const resolved = resolvePortalConfig(portal, {
      request_url: 'https://req.example',
      request_label: 'Overseerr',
    });
    expect(resolved.links.requestUrl).toBe('https://req.example');
    expect(resolved.links.requestLabel).toBe('Overseerr');
  });

  it('prefers an explicit portal link over the extras fallback', () => {
    const portal = PortalConfigSchema.parse({
      links: { request_url: 'https://portal-req.example', request_label: 'Request Portal' },
    });
    const resolved = resolvePortalConfig(portal, {
      request_url: 'https://req.example',
      request_label: 'Overseerr',
    });
    expect(resolved.links.requestUrl).toBe('https://portal-req.example');
    expect(resolved.links.requestLabel).toBe('Request Portal');
  });

  it('passes through an explicit plex_url override', () => {
    const portal = PortalConfigSchema.parse({ links: { plex_url: 'https://plex.example' } });
    const resolved = resolvePortalConfig(portal);
    expect(resolved.links.plexUrl).toBe('https://plex.example');
  });

  it('passes through status_url unchanged (no fallback source)', () => {
    const portal = PortalConfigSchema.parse({ links: { status_url: 'https://status.example' } });
    const resolved = resolvePortalConfig(portal);
    expect(resolved.links.statusUrl).toBe('https://status.example');
  });
});

describe('resolvePortalConfig entries', () => {
  it('default entry list is equivalent to buildHomeButtons for the same input, in the same order', () => {
    const portal = PortalConfigSchema.parse({
      links: { request_url: 'https://req.example', status_url: 'https://status.example' },
    });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    const buttons = buildHomeButtons(resolvePortalConfig(portal), SERVER_NAME);

    expect(resolved.entries.map((e) => e.label)).toEqual(buttons.map((b) => b.label));
    expect(resolved.entries.map((e) => e.href)).toEqual(buttons.map((b) => b.href));
    expect(resolved.entries.map((e) => e.external)).toEqual(buttons.map((b) => b.external));
    expect(resolved.entries.map((e) => e.description)).toEqual(buttons.map((b) => b.description));
  });

  it('default list is the six built-in rows in spec order, numbered 01-06', () => {
    const portal = PortalConfigSchema.parse({
      links: { request_url: 'https://req.example', status_url: 'https://status.example' },
    });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries.map((e) => e.label)).toEqual([
      'Getting started', 'House rules', 'Open Plex', 'Make a request', 'Server status', 'Report an issue',
    ]);
    expect(resolved.entries.map((e) => e.number)).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('appends legacy custom entries after the defaults', () => {
    const portal = PortalConfigSchema.parse({
      custom: [{ type: 'link', label: 'Wiki', url: 'https://wiki.example', description: 'Community wiki.' }],
    });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries.at(-1)).toMatchObject({ label: 'Wiki', href: 'https://wiki.example', external: true });
  });

  it('drops a builtin_page row when its page is disabled', () => {
    const portal = PortalConfigSchema.parse({ pages: { getting_started: { enabled: false } } });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries.map((e) => e.id)).not.toContain('getting_started');
  });

  it('drops request/status builtin_link rows when their URL is unset', () => {
    const portal = PortalConfigSchema.parse({});
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries.map((e) => e.id)).not.toContain('request');
    expect(resolved.entries.map((e) => e.id)).not.toContain('status');
  });

  it('drops a hidden row and renumbers the rest', () => {
    const portal = PortalConfigSchema.parse({
      entries: [
        { type: 'builtin_page', page: 'getting_started', hidden: true },
        { type: 'builtin_page', page: 'rules' },
        { type: 'builtin_link', link: 'plex' },
      ],
    });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries.map((e) => e.id)).toEqual(['rules', 'plex']);
    expect(resolved.entries.map((e) => e.number)).toEqual(['01', '02']);
  });

  it('falls back to default label/description when an entry omits them', () => {
    const portal = PortalConfigSchema.parse({ entries: [{ type: 'builtin_page', page: 'rules' }] });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries[0]).toMatchObject({ label: 'House rules' });
    expect(resolved.entries[0].description).toBe('Short, and mostly about not sharing your login.');
  });

  it('uses a custom label/description when the entry overrides them', () => {
    const portal = PortalConfigSchema.parse({
      entries: [{ type: 'builtin_page', page: 'rules', label: 'Rules', description: 'Read before {{server_name}}.' }],
    });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.entries[0].label).toBe('Rules');
    expect(resolved.entries[0].description).toBe('Read before Orpheus.');
  });

  it('substitutes {{server_name}} into default built-in descriptions', () => {
    const portal = PortalConfigSchema.parse({});
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    const gettingStarted = resolved.entries.find((e) => e.id === 'getting_started');
    expect(gettingStarted?.description).toContain(SERVER_NAME);
    expect(gettingStarted?.description).not.toContain('{{server_name}}');
  });
});

describe('resolvePortalConfig pages', () => {
  it('defaults each built-in page title/eyebrow to spec copy', () => {
    const portal = PortalConfigSchema.parse({});
    const resolved = resolvePortalConfig(portal);
    expect(resolved.pages.getting_started).toMatchObject({ title: 'Getting started', eyebrow: 'Guide' });
    expect(resolved.pages.rules).toMatchObject({ title: 'House rules', eyebrow: 'Rules' });
    expect(resolved.pages.report_issue).toMatchObject({ title: 'Report an issue', eyebrow: 'Help' });
  });

  it('uses a configured title/eyebrow override, substituting tokens', () => {
    const portal = PortalConfigSchema.parse({
      pages: { rules: { title: 'Rules for {{server_name}}', eyebrow: 'Read me' } },
    });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.pages.rules.title).toBe('Rules for Orpheus');
    expect(resolved.pages.rules.eyebrow).toBe('Read me');
  });
});

describe('resolvePortalConfig copy', () => {
  it('matches the spec default copy table', () => {
    const portal = PortalConfigSchema.parse({});
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.copy).toMatchObject({
      tagline: 'A private server for friends and family',
      intro: 'Everything you need to get set up, find your way around, and get help when something breaks.',
      tabTitle: SERVER_NAME,
      tocHeading: 'On this page',
      stuckTitle: 'Stuck?',
      stuckBody: 'Report an issue and include what you were trying to watch.',
      stuckLinkLabel: 'Report an issue',
      backLabel: 'Back to index',
      footer: 'Powered by Tortuga',
      customPageEyebrow: 'Page',
      showStuckCard: true,
      showFooter: true,
    });
  });

  it('substitutes tokens into an overridden copy string', () => {
    const portal = PortalConfigSchema.parse({ copy: { tagline: 'Welcome to {{server_name}}' } });
    const resolved = resolvePortalConfig(portal, undefined, SERVER_NAME);
    expect(resolved.copy.tagline).toBe('Welcome to Orpheus');
  });

  it('respects an explicit show_stuck_card/show_footer override', () => {
    const portal = PortalConfigSchema.parse({ copy: { show_stuck_card: false, show_footer: false } });
    const resolved = resolvePortalConfig(portal);
    expect(resolved.copy.showStuckCard).toBe(false);
    expect(resolved.copy.showFooter).toBe(false);
  });
});
