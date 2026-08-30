import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAppContext = vi.fn();
const invalidateAppContext = vi.fn();
const writeServiceSettings = vi.fn();
const readServiceSettings = vi.fn();
const requireAdminSession = vi.fn();
const testTautulliConnection = vi.fn();
const testTmdbConnection = vi.fn();
const testMaintainerrConnection = vi.fn();
const testAnthropicConnection = vi.fn();
const testOpenaiConnection = vi.fn();

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
  invalidateAppContext: (...args: unknown[]) => invalidateAppContext(...args),
}));

vi.mock('@/kernel/config/service-settings', () => ({
  writeServiceSettings: (...args: unknown[]) => writeServiceSettings(...args),
  readServiceSettings: (...args: unknown[]) => readServiceSettings(...args),
}));

vi.mock('@/kernel/integrations/connection-tests', () => ({
  testTautulliConnection: (...args: unknown[]) => testTautulliConnection(...args),
  testTmdbConnection: (...args: unknown[]) => testTmdbConnection(...args),
  testMaintainerrConnection: (...args: unknown[]) => testMaintainerrConnection(...args),
  testAnthropicConnection: (...args: unknown[]) => testAnthropicConnection(...args),
  testOpenaiConnection: (...args: unknown[]) => testOpenaiConnection(...args),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  saveTautulliSettings,
  saveTmdbSettings,
  saveMaintainerrSettings,
  testTautulli,
  testTmdb,
  type ServiceSaveState,
} from './actions';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const initial: ServiceSaveState = { status: 'idle' };

describe('saveTautulliSettings server action', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    invalidateAppContext.mockReset();
    writeServiceSettings.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    getAppContext.mockReturnValue({ db: {}, env: {} });
  });

  it('rejects when there is no admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(saveTautulliSettings(initial, fd({ 'tautulli.url': 'http://x' }))).rejects.toThrow('Unauthorized');
    expect(writeServiceSettings).not.toHaveBeenCalled();
  });

  it('rejects an invalid URL and does not persist', async () => {
    const r = await saveTautulliSettings(initial, fd({ 'tautulli.url': 'not-a-url' }));
    expect(r.status).toBe('error');
    expect(writeServiceSettings).not.toHaveBeenCalled();
  });

  it('saves a valid url + api key and invalidates the context', async () => {
    const r = await saveTautulliSettings(initial, fd({ 'tautulli.url': 'http://tautulli.local', 'tautulli.api_key': 'k' }));
    expect(r.status).toBe('success');
    expect(writeServiceSettings).toHaveBeenCalledWith(
      {},
      { 'tautulli.url': 'http://tautulli.local', 'tautulli.api_key': 'k' },
      {},
    );
    expect(invalidateAppContext).toHaveBeenCalled();
  });

  it('clears the url when submitted blank (field was present but empty)', async () => {
    const r = await saveTautulliSettings(initial, fd({ 'tautulli.url': '' }));
    expect(r.status).toBe('success');
    expect(writeServiceSettings).toHaveBeenCalledWith({}, { 'tautulli.url': null, 'tautulli.api_key': undefined }, {});
  });

  it('leaves the url untouched when the field is absent (env-disabled)', async () => {
    const r = await saveTautulliSettings(initial, fd({}));
    expect(r.status).toBe('success');
    expect(writeServiceSettings).toHaveBeenCalledWith({}, { 'tautulli.url': undefined, 'tautulli.api_key': undefined }, {});
  });
});

describe('saveTmdbSettings / saveMaintainerrSettings', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    writeServiceSettings.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    getAppContext.mockReturnValue({ db: {}, env: {} });
  });

  it('saveTmdbSettings requires an admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(saveTmdbSettings(initial, fd({}))).rejects.toThrow('Unauthorized');
  });

  it('saveMaintainerrSettings rejects an invalid URL', async () => {
    const r = await saveMaintainerrSettings(initial, fd({ 'maintainerr.url': 'nope' }));
    expect(r.status).toBe('error');
    expect(writeServiceSettings).not.toHaveBeenCalled();
  });
});

describe('test actions', () => {
  beforeEach(() => {
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    readServiceSettings.mockReset();
    testTautulliConnection.mockReset();
    testTmdbConnection.mockReset();
    writeServiceSettings.mockReset();
    invalidateAppContext.mockReset();
    getAppContext.mockReturnValue({ db: {}, env: {} });
  });

  it('testTautulli requires an admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(testTautulli()).rejects.toThrow('Unauthorized');
  });

  it('testTautulli returns an error string when not fully configured', async () => {
    readServiceSettings.mockReturnValue({
      'tautulli.url': { value: undefined, source: undefined },
      'tautulli.api_key': { value: undefined, source: undefined },
    });
    const r = await testTautulli();
    expect(r.ok).toBe(false);
    expect(typeof r.message).toBe('string');
  });

  it('testTmdb pings with the effective key and never mutates state', async () => {
    readServiceSettings.mockReturnValue({ 'tmdb.api_key': { value: 'k', source: 'db' } });
    testTmdbConnection.mockResolvedValue({ ok: true, message: 'Connected.' });
    const r = await testTmdb();
    expect(r.ok).toBe(true);
    expect(writeServiceSettings).not.toHaveBeenCalled();
    expect(invalidateAppContext).not.toHaveBeenCalled();
  });
});
