import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { MailgunProvider, stripAngleBrackets } from './mailgun';

const PROVIDER_OPTS = {
  apiKey: 'key-test',
  webhookSigningKey: 'signing-key-test',
  domain: 'sandbox.mailgun.org',
  region: 'us' as const,
};

function makeHeaders(): Headers {
  return new Headers({});
}

// --- parseEvent ---

describe('MailgunProvider.parseEvent', () => {
  const provider = new MailgunProvider(PROVIDER_OPTS);

  function makeBody(event: string, messageId = '<msg-123@mailgun.org>', timestamp = 1700000000) {
    return JSON.stringify({
      'event-data': {
        event,
        timestamp,
        message: { headers: { 'message-id': messageId } },
      },
    });
  }

  it('maps delivered to delivered', () => {
    const result = provider.parseEvent(makeBody('delivered'));
    expect(result.type).toBe('delivered');
    expect(result.rawType).toBe('delivered');
    expect(result.providerMessageId).toBe('msg-123@mailgun.org');
    expect(result.receivedAt).toEqual(new Date(1700000000 * 1000));
  });

  it('maps permanent_fail to bounced', () => {
    const result = provider.parseEvent(makeBody('permanent_fail'));
    expect(result.type).toBe('bounced');
    expect(result.rawType).toBe('permanent_fail');
  });

  it('maps complained to complained', () => {
    const result = provider.parseEvent(makeBody('complained'));
    expect(result.type).toBe('complained');
  });

  it('maps failed to failed', () => {
    const result = provider.parseEvent(makeBody('failed'));
    expect(result.type).toBe('failed');
  });

  it('maps temporary_fail to other', () => {
    const result = provider.parseEvent(makeBody('temporary_fail'));
    expect(result.type).toBe('other');
    expect(result.rawType).toBe('temporary_fail');
  });
});

// --- verifyWebhook ---

describe('MailgunProvider.verifyWebhook', () => {
  const provider = new MailgunProvider(PROVIDER_OPTS);
  const secret = PROVIDER_OPTS.webhookSigningKey;

  function makeSignedBody(timestamp: string, token: string, extraSecret = secret) {
    const signature = createHmac('sha256', extraSecret)
      .update(`${timestamp}${token}`)
      .digest('hex');
    return JSON.stringify({ signature: { timestamp, token, signature } });
  }

  it('returns true for a valid round-trip signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'abc123token';
    const body = makeSignedBody(timestamp, token);
    expect(provider.verifyWebhook({ body, headers: makeHeaders(), secret })).toBe(true);
  });

  it('returns false for tampered body (wrong signature)', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'abc123token';
    // sign with a different key
    const body = makeSignedBody(timestamp, token, 'wrong-key');
    expect(provider.verifyWebhook({ body, headers: makeHeaders(), secret })).toBe(false);
  });

  it('returns false for an expired timestamp', () => {
    // 1000 seconds old, default tolerance is 300
    const timestamp = String(Math.floor(Date.now() / 1000) - 1000);
    const token = 'abc123token';
    const body = makeSignedBody(timestamp, token);
    expect(provider.verifyWebhook({ body, headers: makeHeaders(), secret })).toBe(false);
  });
});

// --- send ---

describe('MailgunProvider.send', () => {
  const provider = new MailgunProvider(PROVIDER_OPTS);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path returns providerMessageId with angle brackets stripped', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: '<abc123@mailgun.org>', message: 'Queued' }), { status: 200 }),
    );

    const result = await provider.send({
      from: { name: 'Test Sender', email: 'sender@example.com' },
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    expect(result).toEqual({ providerMessageId: 'abc123@mailgun.org', error: null });
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.mailgun.net/v3/sandbox.mailgun.org/messages');
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
  });

  it('forwards the text plain-text part as a form field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: '<abc123@mailgun.org>', message: 'Queued' }), { status: 200 }),
    );

    await provider.send({
      from: { name: 'Test Sender', email: 'sender@example.com' },
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    });

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get('text')).toBe('Test');
  });

  it('omits the text form field when no plain-text part is given', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: '<abc123@mailgun.org>', message: 'Queued' }), { status: 200 }),
    );

    await provider.send({
      from: { name: 'Test Sender', email: 'sender@example.com' },
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get('text')).toBeNull();
  });

  it('non-2xx returns error string', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Forbidden', { status: 401 }),
    );

    const result = await provider.send({
      from: { name: 'Test', email: 'test@example.com' },
      to: 'recipient@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });

    expect(result.providerMessageId).toBeNull();
    expect(result.error).toContain('401');
  });

  it('network throw is caught and returned as error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unreachable'));

    const result = await provider.send({
      from: { name: 'Test', email: 'test@example.com' },
      to: 'recipient@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });

    expect(result.providerMessageId).toBeNull();
    expect(result.error).toBe('Network unreachable');
  });
});

// --- stripAngleBrackets ---

describe('stripAngleBrackets', () => {
  it('removes < and > wrapping', () => {
    expect(stripAngleBrackets('<foo@bar.com>')).toBe('foo@bar.com');
  });

  it('leaves plain string unchanged', () => {
    expect(stripAngleBrackets('foo@bar.com')).toBe('foo@bar.com');
  });
});
