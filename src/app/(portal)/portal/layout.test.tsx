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

const requireAdminSession = vi.fn();
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import PortalLayout from './layout';

const baseCtx = {
  portal: {
    enabled: true,
    appearance: undefined,
    copy: { showFooter: true, footer: 'Powered by Tortuga', tabTitle: 'Test Server' },
  },
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

describe('PortalLayout host-aware auth/enabled gating', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    headersGet.mockReset();
    notFound.mockClear();
    requireAdminSession.mockReset();
  });

  it('(a) admin host + no session + enabled -> notFound', async () => {
    getAppContext.mockReturnValue(baseCtx);
    headersGet.mockReturnValue(null); // no x-portal-host header => admin host
    requireAdminSession.mockRejectedValue(new Error("unauthorized"));
    await expect(PortalLayout({ children: <div>child</div> })).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
  });

  it('(b) admin host + no session + disabled -> notFound', async () => {
    getAppContext.mockReturnValue(disabledCtx());
    headersGet.mockReturnValue(null);
    requireAdminSession.mockRejectedValue(new Error("unauthorized"));
    await expect(PortalLayout({ children: <div>child</div> })).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
  });

  it('(c) admin host + admin session + disabled -> renders with banner', async () => {
    getAppContext.mockReturnValue(disabledCtx());
    headersGet.mockReturnValue(null);
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(notFound).not.toHaveBeenCalled();
    expect(html).toContain('child');
    expect(html.toLowerCase()).toContain('portal is disabled');
  });

  it('(d) portal host + enabled + no session -> renders', async () => {
    getAppContext.mockReturnValue(baseCtx);
    headersGet.mockReturnValue('1'); // x-portal-host set by middleware
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(notFound).not.toHaveBeenCalled();
    expect(requireAdminSession).not.toHaveBeenCalled();
    expect(html).toContain('child');
  });

  it('(e) portal host + disabled -> notFound', async () => {
    getAppContext.mockReturnValue(disabledCtx());
    headersGet.mockReturnValue('1');
    await expect(PortalLayout({ children: <div>child</div> })).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
    expect(requireAdminSession).not.toHaveBeenCalled();
  });

  it('admin host + admin session + enabled -> renders, no banner', async () => {
    getAppContext.mockReturnValue(baseCtx);
    headersGet.mockReturnValue(null);
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(notFound).not.toHaveBeenCalled();
    expect(html).toContain('child');
    expect(html.toLowerCase()).not.toContain('portal is disabled');
  });

  it('renders the configured footer text when show_footer is true', async () => {
    getAppContext.mockReturnValue(baseCtx);
    headersGet.mockReturnValue('1');
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Powered by Tortuga');
  });

  it('omits the footer entirely when show_footer is false', async () => {
    const ctx = { ...baseCtx, portal: { ...baseCtx.portal, copy: { ...baseCtx.portal.copy, showFooter: false } } };
    getAppContext.mockReturnValue(ctx);
    headersGet.mockReturnValue('1');
    const element = await PortalLayout({ children: <div>child</div> });
    const html = renderToStaticMarkup(element);
    expect(html).not.toContain('<footer');
    expect(html).not.toContain('Powered by Tortuga');
  });
});
