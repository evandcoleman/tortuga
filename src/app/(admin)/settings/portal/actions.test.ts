import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAppContext = vi.fn();
const invalidateAppContext = vi.fn();
const writeConfigOverride = vi.fn();
const clearConfigOverride = vi.fn();
const requireAdminSession = vi.fn();

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
  invalidateAppContext: (...args: unknown[]) => invalidateAppContext(...args),
}));

vi.mock('@/kernel/config/overrides', () => ({
  writeConfigOverride: (...args: unknown[]) => writeConfigOverride(...args),
  clearConfigOverride: (...args: unknown[]) => clearConfigOverride(...args),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { savePortalSettings, revertPortalSettings, type SaveState } from './actions';

const initial: SaveState = { status: 'idle' };

const validCandidate = {
  enabled: true,
  domain: 'plex.example.com',
  links: { plex_url: 'https://app.plex.tv' },
};

describe('savePortalSettings server action', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    invalidateAppContext.mockReset();
    writeConfigOverride.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    getAppContext.mockReturnValue({ db: {} });
  });

  it('rejects when there is no admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(savePortalSettings(initial, validCandidate)).rejects.toThrow('Unauthorized');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('returns field errors and does not persist on invalid input', async () => {
    const r = await savePortalSettings(initial, { ...validCandidate, domain: '' });
    expect(r.status).toBe('error');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects a reserved custom page slug with a field error', async () => {
    const r = await savePortalSettings(initial, {
      ...validCandidate,
      custom: [{ type: 'page', slug: 'rules', label: 'x', markdown: 'y' }],
    });
    expect(r.status).toBe('error');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects a custom page entry with both markdown and html', async () => {
    const r = await savePortalSettings(initial, {
      ...validCandidate,
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ', markdown: 'a', html: '<p>a</p>' }],
    });
    expect(r.status).toBe('error');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('saves valid input to the portal section and invalidates the context', async () => {
    const r = await savePortalSettings(initial, validCandidate);
    expect(r.status).toBe('success');
    expect(writeConfigOverride).toHaveBeenCalledWith(
      {},
      'portal',
      expect.objectContaining({ enabled: true, domain: 'plex.example.com' }),
    );
    expect(invalidateAppContext).toHaveBeenCalled();
  });
});

describe('revertPortalSettings server action', () => {
  const staleConfig = { enabled: true, domain: 'stale.example.com' };
  const freshConfig = { enabled: false };

  beforeEach(() => {
    getAppContext.mockReset();
    invalidateAppContext.mockReset();
    clearConfigOverride.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    // First call (before clear/invalidate) sees the stale, pre-revert config;
    // the second call (after invalidateAppContext) sees the reverted one.
    getAppContext
      .mockReturnValueOnce({ db: {}, config: { portal: staleConfig } })
      .mockReturnValue({ db: {}, config: { portal: freshConfig } });
  });

  it('rejects when there is no admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(revertPortalSettings()).rejects.toThrow('Unauthorized');
    expect(clearConfigOverride).not.toHaveBeenCalled();
  });

  it('clears only the portal section override', async () => {
    await revertPortalSettings();
    expect(clearConfigOverride).toHaveBeenCalledWith({}, 'portal');
    expect(invalidateAppContext).toHaveBeenCalled();
  });

  it('returns the resolved config read AFTER invalidation, not the stale pre-revert value (regression: a subsequent Save must not re-write the cleared override)', async () => {
    const result = await revertPortalSettings();
    expect(result).toEqual(freshConfig);
  });
});
