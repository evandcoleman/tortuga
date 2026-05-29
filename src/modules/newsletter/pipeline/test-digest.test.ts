import { describe, it, expect, vi } from 'vitest';

import type { EmailProvider, EmailSendOpts, EmailSendResult } from '@/kernel/email/types';
import { renderAndSendTestDigest, type TestDigestOpts } from './test-digest';
import type { MatrixPreview } from './preview-cache';

function makePreviews(): MatrixPreview[] {
  return [
    { themeId: 'gold', themeLabel: 'Gold', layoutId: 'grid', layoutLabel: 'Grid', html: '<p>gold-grid</p>' },
    { themeId: 'noir', themeLabel: 'Noir', layoutId: 'list', layoutLabel: 'List', html: '<p>noir-list</p>' },
  ];
}

function makeProvider(send: (opts: EmailSendOpts) => Promise<EmailSendResult>): EmailProvider {
  return {
    name: 'resend',
    send: vi.fn(send),
    verifyWebhook: () => true,
    parseEvent: () => ({ type: 'other', providerMessageId: null, rawType: 'x', receivedAt: new Date() }),
  };
}

function baseOpts(overrides: Partial<TestDigestOpts> = {}): TestDigestOpts {
  return {
    digestId: 'dig-1',
    themeId: 'gold',
    layoutId: 'grid',
    toEmail: 'me@example.com',
    subject: 'Test subject',
    provider: makeProvider(async () => ({ providerMessageId: 'msg-1', error: null })),
    from: { email: 'news@tortuga.local', name: 'Tortuga' },
    lookupPreviews: () => ({ digestId: 'dig-1', previews: makePreviews() }),
    ...overrides,
  };
}

describe('renderAndSendTestDigest', () => {
  it('sends the matching theme/layout HTML to the specified address', async () => {
    // Arrange
    const sendSpy = vi.fn(async (): Promise<EmailSendResult> => ({ providerMessageId: 'msg-1', error: null }));
    const provider = makeProvider(sendSpy);
    const opts = baseOpts({ provider, toEmail: 'recipient@example.com', themeId: 'noir', layoutId: 'list' });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result).toEqual({ success: true });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'recipient@example.com', subject: 'Test subject', html: '<p>noir-list</p>' }),
    );
  });

  it('returns success on send success', async () => {
    // Arrange
    const opts = baseOpts();

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('propagates the provider error message on send failure', async () => {
    // Arrange
    const provider = makeProvider(async () => ({ providerMessageId: null, error: 'quota exceeded' }));
    const opts = baseOpts({ provider });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result).toEqual({ success: false, error: 'quota exceeded' });
  });

  it('returns a clear error when the provider throws', async () => {
    // Arrange
    const provider = makeProvider(async () => {
      throw new Error('network down');
    });
    const opts = baseOpts({ provider });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result).toEqual({ success: false, error: 'network down' });
  });

  it('rejects an invalid email without calling the provider', async () => {
    // Arrange
    const sendSpy = vi.fn(async (): Promise<EmailSendResult> => ({ providerMessageId: 'x', error: null }));
    const provider = makeProvider(sendSpy);
    const opts = baseOpts({ provider, toEmail: 'not-an-email' });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid email/i);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('fails gracefully when no preview is cached', async () => {
    // Arrange
    const sendSpy = vi.fn(async (): Promise<EmailSendResult> => ({ providerMessageId: 'x', error: null }));
    const provider = makeProvider(sendSpy);
    const opts = baseOpts({ provider, lookupPreviews: () => null });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no preview available/i);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('fails when the cached preview is for a different digest', async () => {
    // Arrange
    const opts = baseOpts({ lookupPreviews: () => ({ digestId: 'other', previews: makePreviews() }) });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no preview available/i);
  });

  it('fails when the requested theme/layout combo is not in the matrix', async () => {
    // Arrange
    const opts = baseOpts({ themeId: 'gold', layoutId: 'list' });

    // Act
    const result = await renderAndSendTestDigest(opts);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer available/i);
  });
});
