import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar, isActive } from './sidebar';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

function renderSidebar(): string {
  return renderToStaticMarkup(createElement(Sidebar, { authMode: 'forward' }));
}

describe('isActive', () => {
  it('matches exact routes only on exact equality', () => {
    const item = { href: '/settings', label: 'Settings', exact: true, icon: 'settings' as const };
    expect(isActive('/settings', item)).toBe(true);
    expect(isActive('/settings/notifications', item)).toBe(false);
  });

  it('matches non-exact routes on the path and its descendants', () => {
    const item = { href: '/settings', label: 'Settings', icon: 'settings' as const };
    expect(isActive('/settings', item)).toBe(true);
    expect(isActive('/settings/notifications', item)).toBe(true);
    expect(isActive('/other', item)).toBe(false);
  });

  it('does not match a sibling route with a shared prefix', () => {
    const item = { href: '/newsletter', label: 'Overview', exact: true, icon: 'mail' as const };
    expect(isActive('/newsletter/preview', item)).toBe(false);
  });
});

describe('Sidebar navigation', () => {
  it('renders Dashboard first without an Overview group or newsletter overview link', () => {
    const html = renderSidebar();

    expect(html).not.toContain('>Overview<');
    expect(html).not.toMatch(/href="\/newsletter"(?!\/)/);
    expect(html.indexOf('>Dashboard<')).toBeLessThan(html.indexOf('>Newsletter<'));
  });
});
