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
    const portal = resolvePortalConfig(PortalConfigSchema.parse({}));
    getAppContext.mockReturnValue(ctxWith(portal));

    const html = renderToStaticMarkup(await PortalHome());

    expect(html).toContain('Orpheus.');
    expect(html).toContain('Accept the invite, install an app, pick Orpheus, press play.');
  });
});
