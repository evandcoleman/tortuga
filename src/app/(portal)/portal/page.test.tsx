import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { resolvePortalConfig } from '@/kernel/config/portal';

const getAppContext = vi.fn();
vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
}));

const headersGet = vi.fn();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: headersGet }),
}));

import PortalHome from './page';

function ctxWith(portal: ReturnType<typeof resolvePortalConfig>) {
  return {
    portal,
    config: { newsletter: { from: { name: 'Orpheus' } } },
  };
}

describe('PortalHome (masthead index)', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    headersGet.mockReset();
    headersGet.mockReturnValue('1'); // portal host, root-relative links
  });

  it('numbers rows sequentially starting at 01 and uses a right-arrow for internal rows', async () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());

    expect(html).toContain('01');
    expect(html).toContain('02');
    // Getting started is internal -> the plain rightward-arrow icon (M5 12h14).
    expect(html).toContain('M5 12h14');
  });

  it('uses an up-right arrow for external rows (e.g. Open Plex)', async () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());

    // Open Plex is external -> the up-right arrow icon (M7 17L17 7).
    expect(html).toContain('M7 17L17 7');
  });

  it('renders the masthead H1 as "{server_name}." and includes row descriptions', async () => {
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}), undefined, 'Orpheus');
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());

    expect(html).toContain('Orpheus.');
    expect(html).toContain('Accept the invite, install an app, pick Orpheus, press play.');
  });

  it('renders rows in configured order, honoring custom labels and hiding a disabled row', async () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        entries: [
          { type: 'builtin_page', page: 'rules', label: 'Ground Rules' },
          { type: 'builtin_page', page: 'getting_started', hidden: true },
          { type: 'builtin_link', link: 'plex' },
        ],
      }),
      undefined,
      'Orpheus',
    );
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());
    const rowOrder = [...html.matchAll(/data-testid="portal-home-row"/g)].length;

    expect(rowOrder).toBe(2);
    expect(html).toContain('Ground Rules');
    expect(html).not.toContain('Getting started');
    // Ground Rules (rules) comes before Open Plex in document order.
    expect(html.indexOf('Ground Rules')).toBeLessThan(html.indexOf('Open Plex'));
  });

  it('renders the tagline and intro from resolved copy', async () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({ copy: { tagline: 'Custom tagline', intro: 'Custom intro.' } }),
    );
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());

    expect(html).toContain('Custom tagline');
    expect(html).toContain('Custom intro.');
  });

  it('escapes HTML in an entry label instead of injecting it', async () => {
    const portal = resolvePortalConfig(
      PortalConfigSchema.parse({
        entries: [{ type: 'builtin_page', page: 'rules', label: '<b>Rules</b>' }],
      }),
    );
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());

    expect(html).not.toContain('<b>Rules</b>');
    expect(html).toContain('&lt;b&gt;Rules&lt;/b&gt;');
  });
});
