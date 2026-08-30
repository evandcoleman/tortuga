import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdminSession = vi.fn();
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { importAppearance } from './actions';

describe('importAppearance', () => {
  beforeEach(() => {
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(importAppearance('{}')).rejects.toThrow('Unauthorized');
  });

  it('parses a valid appearance JSON', async () => {
    const r = await importAppearance(
      JSON.stringify({
        appearance: { item_display: { show_poster: false } },
        theme: 'swiss',
        layout: 'compact',
      }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.theme).toBe('swiss');
      expect(r.appearance.item_display?.show_poster).toBe(false);
    }
  });

  it('rejects malformed JSON', async () => {
    const r = await importAppearance('{ not json');
    expect(r.success).toBe(false);
  });

  it('rejects an unsafe color in imported JSON', async () => {
    const r = await importAppearance(
      JSON.stringify({
        appearance: { theme_overrides: { palette: { accent: 'red;}' } } },
      }),
    );
    expect(r.success).toBe(false);
  });
});
