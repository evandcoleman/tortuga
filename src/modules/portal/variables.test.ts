import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { resolvePortalConfig } from '@/kernel/config/portal';
import { getPortalVariables, toPortalTokens } from './variables';

describe('getPortalVariables', () => {
  it('takes server_name from newsletter.from.name', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Olympus', email: 'a@x.io' } });
    expect(vars.serverName).toBe('Olympus');
  });

  it('passes through configured links', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        links: { request_url: 'https://req.example', request_label: 'Overseerr', status_url: 'https://status.example' },
      }),
    );
    const vars = getPortalVariables(portal, { from: { name: 'Olympus', email: 'a@x.io' } });
    expect(vars.requestUrl).toBe('https://req.example');
    expect(vars.requestLabel).toBe('Overseerr');
    expect(vars.statusUrl).toBe('https://status.example');
    expect(vars.plexUrl).toBe('https://app.plex.tv');
  });

  it('falls back request_url/request_label to renderable defaults when unset', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Olympus', email: 'a@x.io' } });
    expect(vars.requestUrl).toBe('#');
    expect(vars.requestLabel).toBe('the request service');
  });
});

describe('toPortalTokens', () => {
  it('maps to the {{token}} names used in portal markdown', () => {
    const tokens = toPortalTokens({
      serverName: 'Olympus',
      requestUrl: 'https://req.example',
      requestLabel: 'Overseerr',
      statusUrl: 'https://status.example',
      plexUrl: 'https://app.plex.tv',
    });
    expect(tokens).toEqual({
      server_name: 'Olympus',
      request_url: 'https://req.example',
      request_label: 'Overseerr',
      status_url: 'https://status.example',
      plex_url: 'https://app.plex.tv',
    });
  });
});
