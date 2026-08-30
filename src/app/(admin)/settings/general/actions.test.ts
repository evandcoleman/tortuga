import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAppContext = vi.fn();
const invalidateAppContext = vi.fn();
const writeConfigOverride = vi.fn();
const requireAdminSession = vi.fn();

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
  invalidateAppContext: (...args: unknown[]) => invalidateAppContext(...args),
}));

vi.mock('@/kernel/config/overrides', () => ({
  writeConfigOverride: (...args: unknown[]) => writeConfigOverride(...args),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveGeneralSettings, type SaveState } from './actions';
import { NewsletterConfigSchema } from '@/kernel/config/schema';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const base = {
  schedule: '0 9 * * SUN',
  timezone: 'America/New_York',
  schedule_enabled: 'on',
  lookback_days: '7',
};

const currentConfig = NewsletterConfigSchema.parse({
  from: { email: 'newsletter@example.com', name: 'Orpheus' },
});

const initial: SaveState = { status: 'idle' };

describe('saveGeneralSettings server action', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    invalidateAppContext.mockReset();
    writeConfigOverride.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    getAppContext.mockReturnValue({ db: {}, config: { newsletter: currentConfig } });
  });

  it('rejects when there is no admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(saveGeneralSettings(initial, fd(base))).rejects.toThrow('Unauthorized');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects an invalid schedule cron with a field error and does not persist', async () => {
    const r = await saveGeneralSettings(initial, fd({ ...base, lookback_days: '-1' }));
    expect(r.status).toBe('error');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('saves valid input and invalidates the context', async () => {
    const r = await saveGeneralSettings(initial, fd(base));
    expect(r.status).toBe('success');
    expect(writeConfigOverride).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ schedule: '0 9 * * SUN', lookback_days: 7 }),
    );
    expect(invalidateAppContext).toHaveBeenCalled();
  });

  it('writes only its own fields, leaving other pages’ config untouched', async () => {
    getAppContext.mockReturnValue({
      db: {},
      config: { newsletter: { ...currentConfig, from: { email: 'other@example.com', name: 'Other' } } },
    });
    const r = await saveGeneralSettings(initial, fd(base));
    expect(r.status).toBe('success');
    expect(writeConfigOverride).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ from: { email: 'other@example.com', name: 'Other' } }),
    );
  });
});
