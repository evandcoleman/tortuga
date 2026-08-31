import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

const mockEmailsSend = vi.fn();

vi.mock('resend', () => {
  class MockResend {
    emails = { send: mockEmailsSend };
  }
  return { Resend: MockResend };
});

import { ResendProvider } from './resend';

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('ResendProvider.verifyWebhook', () => {
  it('accepts valid signature', () => {
    const provider = new ResendProvider({ apiKey: 'test', webhookSecret: 'whsec_test' });
    const secret = 'whsec_test';
    const body = '{"type":"email.delivered"}';
    const ts = '1700000000';
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    const headers = makeHeaders({ 'Resend-Signature': `t=${ts},v1=${sig}` });
    expect(provider.verifyWebhook({ body, headers, secret, tolerance: Number.MAX_SAFE_INTEGER })).toBe(true);
  });

  it('rejects tampered body', () => {
    const provider = new ResendProvider({ apiKey: 'test', webhookSecret: 'whsec_test' });
    const secret = 'whsec_test';
    const ts = '1700000000';
    const sig = createHmac('sha256', secret).update(`${ts}.original`).digest('hex');
    const headers = makeHeaders({ 'Resend-Signature': `t=${ts},v1=${sig}` });
    expect(provider.verifyWebhook({ body: 'tampered', headers, secret, tolerance: Number.MAX_SAFE_INTEGER })).toBe(false);
  });

  it('rejects malformed header', () => {
    const provider = new ResendProvider({ apiKey: 'test' });
    const headers = makeHeaders({ 'Resend-Signature': 'garbage' });
    expect(provider.verifyWebhook({ body: 'x', headers, secret: 'x' })).toBe(false);
  });

  it('rejects missing Resend-Signature header', () => {
    const provider = new ResendProvider({ apiKey: 'test' });
    const headers = makeHeaders({});
    expect(provider.verifyWebhook({ body: 'x', headers, secret: 'x' })).toBe(false);
  });
});

describe('ResendProvider.send', () => {
  beforeEach(() => {
    mockEmailsSend.mockReset();
  });

  it('happy path returns providerMessageId', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg_abc123' }, error: null });

    const provider = new ResendProvider({ apiKey: 're_test_key' });
    const result = await provider.send({
      from: { name: 'Test', email: 'test@example.com' },
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    });
    expect(result).toEqual({ providerMessageId: 'msg_abc123', error: null });
  });

  it('forwards the text plain-text part to the provider', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg_abc123' }, error: null });

    const provider = new ResendProvider({ apiKey: 're_test_key' });
    await provider.send({
      from: { name: 'Test', email: 'test@example.com' },
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      text: 'Hello',
    });
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello' }));
  });

  it('error path returns error string', async () => {
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: 'API rate limit exceeded', statusCode: 429, name: 'rate_limit_exceeded' },
    });

    const provider = new ResendProvider({ apiKey: 're_test_key' });
    const result = await provider.send({
      from: { name: 'Test', email: 'test@example.com' },
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    });
    expect(result).toEqual({ providerMessageId: null, error: 'API rate limit exceeded' });
  });
});

describe('ResendProvider.parseEvent', () => {
  const provider = new ResendProvider({ apiKey: 'test' });

  it('maps email.delivered to delivered', () => {
    const event = provider.parseEvent('{"type":"email.delivered","data":{"email_id":"msg_abc"}}');
    expect(event.type).toBe('delivered');
    expect(event.providerMessageId).toBe('msg_abc');
    expect(event.rawType).toBe('email.delivered');
  });

  it('maps email.bounced to bounced', () => {
    const event = provider.parseEvent('{"type":"email.bounced","data":{"email_id":"msg_xyz"}}');
    expect(event.type).toBe('bounced');
  });

  it('maps unknown event type to other', () => {
    const event = provider.parseEvent('{"type":"email.opened","data":{"email_id":"msg_123"}}');
    expect(event.type).toBe('other');
    expect(event.rawType).toBe('email.opened');
  });

  it('returns a safe "other" event instead of throwing on malformed JSON', () => {
    const event = provider.parseEvent('not json{');
    expect(event.type).toBe('other');
    expect(event.providerMessageId).toBeNull();
    expect(event.rawType).toBe('');
  });

  it('maps a Permanent bounce to bounceType "permanent"', () => {
    const event = provider.parseEvent(
      '{"type":"email.bounced","data":{"email_id":"msg_1","bounce":{"type":"Permanent"}}}',
    );
    expect(event.bounceType).toBe('permanent');
  });

  it('maps a Transient bounce to bounceType "transient"', () => {
    const event = provider.parseEvent(
      '{"type":"email.bounced","data":{"email_id":"msg_2","bounce":{"type":"Transient"}}}',
    );
    expect(event.bounceType).toBe('transient');
  });

  it('maps an Undetermined bounce to bounceType "undetermined"', () => {
    const event = provider.parseEvent(
      '{"type":"email.bounced","data":{"email_id":"msg_3","bounce":{"type":"Undetermined"}}}',
    );
    expect(event.bounceType).toBe('undetermined');
  });

  it('leaves bounceType undefined when bounce data is absent', () => {
    const event = provider.parseEvent('{"type":"email.bounced","data":{"email_id":"msg_4"}}');
    expect(event.bounceType).toBeUndefined();
  });

  it('leaves bounceType undefined for an unrecognized bounce subtype', () => {
    const event = provider.parseEvent(
      '{"type":"email.bounced","data":{"email_id":"msg_5","bounce":{"type":"SomethingNew"}}}',
    );
    expect(event.bounceType).toBeUndefined();
  });
});
