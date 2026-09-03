import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import type { EmailProvider } from '@/kernel/email/types';

import { alerts } from './schema';
import { emailPendingAlerts, absoluteHref, type AlertEmailConfig } from './email';

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

function insertAlert(db: ReturnType<typeof createDb>, overrides: Partial<typeof alerts.$inferInsert> = {}) {
  const now = new Date();
  const id = overrides.id ?? `alert_${Math.random().toString(36).slice(2)}`;
  db.insert(alerts).values({
    id,
    kind: 'digest_failed',
    key: id,
    title: 'Digest failed',
    detail: 'oops',
    href: '/newsletter/history',
    createdAt: now,
    updatedAt: now,
    emailAttempts: 0,
    ...overrides,
  }).run();
  return id;
}

describe('absoluteHref', () => {
  it('collapses a double slash when appUrl has a trailing slash', () => {
    expect(absoluteHref('http://x/', '/newsletter/history')).toBe('http://x/newsletter/history');
  });

  it('inserts a slash when href has no leading slash', () => {
    expect(absoluteHref('http://x', 'newsletter/history')).toBe('http://x/newsletter/history');
  });

  it('returns null when href is null', () => {
    expect(absoluteHref('http://x', null)).toBeNull();
  });
});

describe('emailPendingAlerts', () => {
  it('batches all pending alerts into one send and sets emailed_at', async () => {
    const db = makeDb();
    const id1 = insertAlert(db, { title: 'First alert', href: '/newsletter/history' });
    const id2 = insertAlert(db, { title: 'Second alert', href: null });
    const provider = fakeProvider();
    const result = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(result).toEqual({ emailed: 2, skipped: 0 });
    expect(provider.send).toHaveBeenCalledTimes(1);
    const rows = db.select().from(alerts).all();
    expect(rows.find(r => r.id === id1)?.emailedAt).not.toBeNull();
    expect(rows.find(r => r.id === id2)?.emailedAt).not.toBeNull();
  });

  it('includes each alert title and an absolute href in the body', async () => {
    const db = makeDb();
    insertAlert(db, { title: 'Digest failed', href: '/newsletter/history' });
    const provider = fakeProvider();
    await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    const sendArg = (provider.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sendArg.html).toContain('Digest failed');
    expect(sendArg.html).toContain('http://x/newsletter/history');
  });

  it('returns emailed 0 skipped 0 when there is nothing pending', async () => {
    const db = makeDb();
    const provider = fakeProvider();
    const result = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(result).toEqual({ emailed: 0, skipped: 0 });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('increments attempts and leaves emailed_at null on provider failure', async () => {
    const db = makeDb();
    const id = insertAlert(db);
    const provider = fakeProvider({ send: vi.fn().mockResolvedValue({ providerMessageId: null, error: 'boom' }) });
    const result = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(result).toEqual({ emailed: 0, skipped: 1 });
    const [row] = db.select().from(alerts).where(eq(alerts.id, id)).all();
    expect(row.emailedAt).toBeNull();
    expect(row.emailAttempts).toBe(1);
  });

  it('skips an alert that has already hit the attempt cap', async () => {
    const db = makeDb();
    insertAlert(db, { emailAttempts: 3 });
    const provider = fakeProvider();
    const result = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(result).toEqual({ emailed: 0, skipped: 0 });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('retries an alert on its third attempt and stops after that', async () => {
    const db = makeDb();
    const id = insertAlert(db, { emailAttempts: 2 });
    const provider = fakeProvider({ send: vi.fn().mockResolvedValue({ providerMessageId: null, error: 'boom' }) });
    const result = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(result).toEqual({ emailed: 0, skipped: 1 });
    const [row] = db.select().from(alerts).where(eq(alerts.id, id)).all();
    expect(row.emailAttempts).toBe(3);

    const secondResult = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(secondResult).toEqual({ emailed: 0, skipped: 0 });
  });

  it('skips without error when admin email is null', async () => {
    const db = makeDb();
    insertAlert(db);
    const provider = fakeProvider();
    const result = await emailPendingAlerts({
      db, provider, config: baseConfig, appUrl: 'http://x', adminEmail: null,
    });
    expect(result).toEqual({ emailed: 0, skipped: 1 });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('skips without error when the provider is null', async () => {
    const db = makeDb();
    insertAlert(db);
    const result = await emailPendingAlerts({
      db, provider: null, config: baseConfig, appUrl: 'http://x', adminEmail: 'admin@x.io',
    });
    expect(result).toEqual({ emailed: 0, skipped: 1 });
  });
});
