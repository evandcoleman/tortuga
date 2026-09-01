import { describe, it, expect } from 'vitest';
import { resolvePortalConfig } from './portal';
import { PortalConfigSchema } from './schema';

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
