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

import { saveContentSettings, type SaveState } from './actions';
import { NewsletterConfigSchema } from '@/kernel/config/schema';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const base = {
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

const currentConfig = NewsletterConfigSchema.parse({
  from: { email: 'newsletter@example.com', name: 'Orpheus' },
});

const initial: SaveState = { status: 'idle' };

describe('saveContentSettings server action', () => {
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
    await expect(saveContentSettings(initial, fd(base))).rejects.toThrow('Unauthorized');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects leaving.days of 0 with a field error and does not persist', async () => {
    const result = await saveContentSettings(initial, fd({ ...base, 'leaving.days': '0' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.errors['leaving.days']).toBeTruthy();
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('accepts a multi-value exclusions checklist and persists it', async () => {
    const form = fd({ ...base, 'leaving.enabled': 'on' });
    form.append('leaving.excluded_collection_ids', '3');
    form.append('leaving.excluded_collection_ids', '9');

    const result = await saveContentSettings(initial, form);

    expect(result.status).toBe('success');
    expect(writeConfigOverride).toHaveBeenCalledWith(
      {},
      'newsletter',
      expect.objectContaining({
        leaving: expect.objectContaining({ excluded_collection_ids: [3, 9] }),
      }),
    );
  });

  it('writes only its own fields, leaving other pages’ config untouched', async () => {
    getAppContext.mockReturnValue({
      db: {},
      config: { newsletter: { ...currentConfig, schedule: '30 7 * * MON' } },
    });
    const result = await saveContentSettings(initial, fd(base));
    expect(result.status).toBe('success');
    expect(writeConfigOverride).toHaveBeenCalledWith(
      {},
      'newsletter',
      expect.objectContaining({ schedule: '30 7 * * MON' }),
    );
  });
});
