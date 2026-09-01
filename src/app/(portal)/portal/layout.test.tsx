import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const getAppContext = vi.fn();
vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
}));

const headersGet = vi.fn();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: headersGet }),
}));

class NotFoundError extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundError('notFound');
});
vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

import PortalLayout from './layout';

const baseCtx = {
  portal: { enabled: true, appearance: undefined },
  config: {
    newsletter: {
      theme: 'classic',
      appearance: {},
      from: { name: 'Test Server' },
    },
  },
};

function disabledCtx() {
  return { ...baseCtx, portal: { ...baseCtx.portal, enabled: false } };
}

describe('PortalLayout host-aware enabled gating', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    headersGet.mockReset();
    notFound.mockClear();
  });

  it('renders normally when the portal is enabled, regardless of host', async () => {
    getAppContext.mockReturnValue(baseCtx);
    headersGet.mockReturnValue(null);
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('child');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('404s a genuine portal-host request when the portal is disabled', async () => {
    getAppContext.mockReturnValue(disabledCtx());
    headersGet.mockReturnValue('1'); // x-portal-host set by middleware
    await expect(PortalLayout({ children: <div>child</div> })).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
  });

  it('renders a preview with a disabled banner on the admin host when the portal is disabled', async () => {
    getAppContext.mockReturnValue(disabledCtx());
    headersGet.mockReturnValue(null); // no x-portal-host header => admin host preview
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(notFound).not.toHaveBeenCalled();
    expect(html).toContain('child');
    expect(html.toLowerCase()).toContain('portal is disabled');
  });
});
