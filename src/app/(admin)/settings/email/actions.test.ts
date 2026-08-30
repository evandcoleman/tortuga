import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAppContext = vi.fn();
const invalidateAppContext = vi.fn();
const writeConfigOverride = vi.fn();
const writeServiceSettings = vi.fn();
const readServiceSettings = vi.fn();
const requireAdminSession = vi.fn();
const testResendConnection = vi.fn();
const testMailgunConnection = vi.fn();

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
  invalidateAppContext: (...args: unknown[]) => invalidateAppContext(...args),
}));

vi.mock('@/kernel/config/overrides', () => ({
  writeConfigOverride: (...args: unknown[]) => writeConfigOverride(...args),
}));

vi.mock('@/kernel/config/service-settings', () => ({
  writeServiceSettings: (...args: unknown[]) => writeServiceSettings(...args),
  readServiceSettings: (...args: unknown[]) => readServiceSettings(...args),
}));

vi.mock('@/kernel/integrations/connection-tests', () => ({
  testResendConnection: (...args: unknown[]) => testResendConnection(...args),
  testMailgunConnection: (...args: unknown[]) => testMailgunConnection(...args),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveEmailSettings, testResend, testMailgun, type SaveState } from './actions';
import { NewsletterConfigSchema } from '@/kernel/config/schema';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const currentConfig = NewsletterConfigSchema.parse({
  from: { email: 'newsletter@example.com', name: 'Orpheus' },
});

const base = {
  'from.email': 'newsletter@example.com',
  'from.name': 'Orpheus',
  'email.provider': 'resend',
};

const initial: SaveState = { status: 'idle' };

describe('saveEmailSettings server action', () => {
  beforeEach(() => {
    getAppContext.mockReset();
    invalidateAppContext.mockReset();
    writeConfigOverride.mockReset();
    writeServiceSettings.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    getAppContext.mockReturnValue({ db: {}, env: { SESSION_SECRET: 'x'.repeat(32) }, config: { newsletter: currentConfig } });
  });

  it('rejects when there is no admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(saveEmailSettings(initial, fd(base))).rejects.toThrow('Unauthorized');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('rejects mailgun without a domain', async () => {
    const r = await saveEmailSettings(initial, fd({ ...base, 'email.provider': 'mailgun' }));
    expect(r.status).toBe('error');
    expect(writeConfigOverride).not.toHaveBeenCalled();
  });

  it('saves config and leaves secrets untouched when fields are blank (keep semantics)', async () => {
    const r = await saveEmailSettings(initial, fd(base));
    expect(r.status).toBe('success');
    expect(writeServiceSettings).toHaveBeenCalledWith(
      {},
      {
        'resend.api_key': undefined,
        'resend.webhook_secret': undefined,
        'mailgun.api_key': undefined,
        'mailgun.webhook_signing_key': undefined,
      },
      expect.anything(),
    );
  });

  it('replaces a secret when typed and clears it when the clear checkbox is set', async () => {
    const form = fd({ ...base, 'resend.api_key': 'new-key', 'mailgun.api_key__clear': 'on' });
    const r = await saveEmailSettings(initial, form);
    expect(r.status).toBe('success');
    expect(writeServiceSettings).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ 'resend.api_key': 'new-key', 'mailgun.api_key': null }),
      expect.anything(),
    );
  });

  it('invalidates the app context after a successful save', async () => {
    await saveEmailSettings(initial, fd(base));
    expect(invalidateAppContext).toHaveBeenCalled();
  });
});

describe('test buttons', () => {
  beforeEach(() => {
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    readServiceSettings.mockReset();
    testResendConnection.mockReset();
    testMailgunConnection.mockReset();
    writeServiceSettings.mockReset();
    invalidateAppContext.mockReset();
    getAppContext.mockReturnValue({ db: {}, env: {}, config: { newsletter: currentConfig } });
  });

  it('testResend requires an admin session', async () => {
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));
    await expect(testResend()).rejects.toThrow('Unauthorized');
  });

  it('testResend returns an error string when the key is unset', async () => {
    readServiceSettings.mockReturnValue({ 'resend.api_key': { value: undefined, source: undefined } });
    const result = await testResend();
    expect(result.ok).toBe(false);
    expect(typeof result.message).toBe('string');
  });

  it('testMailgun pings with the effective key and never mutates state', async () => {
    readServiceSettings.mockReturnValue({ 'mailgun.api_key': { value: 'k', source: 'db' } });
    testMailgunConnection.mockResolvedValue({ ok: true, message: 'Connected.' });
    const result = await testMailgun();
    expect(result.ok).toBe(true);
    expect(writeServiceSettings).not.toHaveBeenCalled();
    expect(invalidateAppContext).not.toHaveBeenCalled();
  });

  it('testMailgun pings using the submitted (unsaved) region rather than the saved config', async () => {
    readServiceSettings.mockReturnValue({ 'mailgun.api_key': { value: 'k', source: 'db' } });
    testMailgunConnection.mockResolvedValue({ ok: true, message: 'Connected.' });
    // ctx.config.newsletter.email.mailgun.region is 'us' (see mocked getAppContext below);
    // passing 'eu' explicitly should override it.
    await testMailgun('eu');
    expect(testMailgunConnection).toHaveBeenCalledWith('k', 'eu');
  });
});
