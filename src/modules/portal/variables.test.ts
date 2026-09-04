import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { resolvePortalConfig } from '@/kernel/config/portal';
import { getPortalVariables, toPortalTokens } from './variables';

describe('getPortalVariables', () => {
  it('takes server_name from newsletter.from.name', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } });
    expect(vars.serverName).toBe('Aurora');
  });

  it('passes through configured links', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        links: { request_url: 'https://req.example', request_label: 'Overseerr', status_url: 'https://status.example' },
      }),
    );
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } });
    expect(vars.requestUrl).toBe('https://req.example');
    expect(vars.requestLabel).toBe('Overseerr');
    expect(vars.statusUrl).toBe('https://status.example');
    expect(vars.plexUrl).toBe('https://app.plex.tv');
  });

  it('falls back request_url/request_label to renderable defaults when unset', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } });
    expect(vars.requestUrl).toBe('#');
    expect(vars.requestLabel).toBe('the request service');
  });

  it('leaves reportIssueUrl undefined when no basePath is passed', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } });
    expect(vars.reportIssueUrl).toBeUndefined();
    expect(toPortalTokens(vars).report_issue_url).toBeUndefined();
  });

  it('builds reportIssueUrl from basePath when the report-issue page is enabled', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } }, { basePath: '' });
    expect(vars.reportIssueUrl).toBe('/report-issue');
  });

  it('prefixes reportIssueUrl with the admin-host basePath', () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } }, { basePath: '/portal' });
    expect(vars.reportIssueUrl).toBe('/portal/report-issue');
  });

  it('falls back reportIssueUrl to requestUrl when the report-issue page is disabled', () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        pages: { report_issue: { enabled: false } },
        links: { request_url: 'https://req.example' },
      }),
    );
    const vars = getPortalVariables(portal, { from: { name: 'Aurora', email: 'a@x.io' } }, { basePath: '/portal' });
    expect(vars.reportIssueUrl).toBe(vars.requestUrl);
    expect(vars.reportIssueUrl).toBe('https://req.example');
  });
});

describe('toPortalTokens', () => {
  it('maps to the {{token}} names used in portal markdown', () => {
    const tokens = toPortalTokens({
      serverName: 'Aurora',
      requestUrl: 'https://req.example',
      requestLabel: 'Overseerr',
      statusUrl: 'https://status.example',
      plexUrl: 'https://app.plex.tv',
    });
    expect(tokens).toEqual({
      server_name: 'Aurora',
      request_url: 'https://req.example',
      request_label: 'Overseerr',
      status_url: 'https://status.example',
      plex_url: 'https://app.plex.tv',
    });
  });
});
