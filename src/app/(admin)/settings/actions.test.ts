import { describe, it, expect, vi, beforeEach } from 'vitest';

// saveSettings delegates parsing to parseNewsletterForm (unmocked — exercised
// for real) and persistence to writeConfigOverride; only the app context and
// admin-session gate are mocked.
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
  clearConfigOverride: vi.fn(),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveSettings, type SaveState } from './actions';

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
  'email.provider': 'resend',
  'from.email': 'newsletter@example.com',
  'from.name': 'Orpheus',
  'filters.min_tmdb_rating': '6',
  'filters.dedupe_episodes_into_seasons': 'on',
  'filters.max_items_per_section': '12',
  'filters.exclude_genres': '',
  'commentary.enabled': '',
  'commentary.provider': 'anthropic',
  'commentary.model': '',
  'commentary.voice': '',
  'leaving.days': '7',
  'leaving.heading': 'Leaving soon',
};

const initial: SaveState = { status: 'idle' };

describe('saveSettings server action', () => {
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

    await expect(saveSettings(initial, fd(base))).rejects.toThrow('Unauthorized');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects leaving.days of 0 with a field error and does not persist', async () => {
    const result = await saveSettings(initial, fd({ ...base, 'leaving.days': '0' }));

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.errors['leaving.days']).toBeTruthy();
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects leaving.days of 91 with a field error and does not persist', async () => {
    const result = await saveSettings(initial, fd({ ...base, 'leaving.days': '91' }));

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.errors['leaving.days']).toBeTruthy();
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('accepts a multi-value exclusions checklist and persists it', async () => {
    const form = fd({ ...base, 'leaving.enabled': 'on' });
    form.append('leaving.excluded_collection_ids', '3');
    form.append('leaving.excluded_collection_ids', '9');

    const result = await saveSettings(initial, form);

    expect(result.status).toBe('success');
    expect(writeConfigOverride).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        leaving: expect.objectContaining({ excluded_collection_ids: [3, 9] }),
      }),
    );
  });
});
