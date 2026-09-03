import { describe, it, expect, vi } from 'vitest';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import type { EmailProvider } from '@/kernel/email/types';

import { alerts } from './schema';
import { runAlertsTick } from './tick';
import type { AlertEmailConfig } from './email';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

function fakeProvider(overrides: Partial<EmailProvider> = {}): EmailProvider {
  return {
    name: 'resend',
    send: vi.fn().mockResolvedValue({ providerMessageId: 'msg_1', error: null }),
    verifyWebhook: vi.fn(),
    parseEvent: vi.fn(),
    ...overrides,
  } as EmailProvider;
}

const baseConfig: AlertEmailConfig = {
  from: { email: 'from@x.io', name: 'Tortuga' },
  theme: 'editorial',
};

describe('runAlertsTick', () => {
  it('records and emails a scheduler_error alert in the same tick when the sweep throws', async () => {
    const db = makeDb();
    const provider = fakeProvider();
    const sweep = vi.fn(() => {
      throw new Error('sweep exploded');
    });

    const result = await runAlertsTick(
      { db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io', sweep },
      { now: new Date(), timezone: 'UTC' },
    );

    const rows = db.select().from(alerts).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'scheduler_error' });
    expect(rows[0].detail).toBe('sweep exploded');

    expect(provider.send).toHaveBeenCalledTimes(1);
    const sendArg = (provider.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sendArg.html).toContain('alerts.sweep');
    expect(sendArg.html).toContain('sweep exploded');
    expect(result.emailed).toBe(1);
  });

  it('does not throw when the sweep throws', async () => {
    const db = makeDb();
    const provider = fakeProvider();
    const sweep = vi.fn(() => {
      throw new Error('boom');
    });

    await expect(
      runAlertsTick(
        { db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io', sweep },
        { now: new Date(), timezone: 'UTC' },
      ),
    ).resolves.not.toThrow();
  });
});
