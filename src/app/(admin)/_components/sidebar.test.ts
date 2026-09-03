import { describe, expect, it } from 'vitest';
import { isActive } from './sidebar';

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
