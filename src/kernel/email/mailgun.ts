import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  EmailProvider,
  EmailSendOpts,
  EmailSendResult,
  NormalizedEvent,
  NormalizedEventType,
  VerifyOpts,
} from './types';

export interface MailgunProviderOpts {
  apiKey: string;
  webhookSigningKey: string;
  domain: string;
  region?: 'us' | 'eu';
}

/** Remove leading '<' and trailing '>' if both are present. */
export function stripAngleBrackets(s: string): string {
  if (s.startsWith('<') && s.endsWith('>')) {
    return s.slice(1, -1);
  }
  return s;
}

const EVENT_TYPE_MAP: Record<string, NormalizedEventType> = {
  delivered: 'delivered',
  permanent_fail: 'bounced',
  complained: 'complained',
  failed: 'failed',
  temporary_fail: 'other',
};

export class MailgunProvider implements EmailProvider {
  readonly name = 'mailgun' as const;

  private readonly apiKey: string;
  private readonly webhookSigningKey: string;
  private readonly domain: string;
  private readonly region: 'us' | 'eu';

  constructor(opts: MailgunProviderOpts) {
    this.apiKey = opts.apiKey;
    this.webhookSigningKey = opts.webhookSigningKey;
    this.domain = opts.domain;
    this.region = opts.region ?? 'us';
  }

  async send(opts: EmailSendOpts): Promise<EmailSendResult> {
    const base = this.region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net';
    const url = `${base}/v3/${this.domain}/messages`;

    const auth = Buffer.from(`api:${this.apiKey}`).toString('base64');
    const form = new FormData();
    form.append('from', `${opts.from.name} <${opts.from.email}>`);
    form.append('to', opts.to);
    form.append('subject', opts.subject);
    form.append('html', opts.html);
    if (opts.replyTo) {
      form.append('h:Reply-To', opts.replyTo);
    }
    if (opts.headers) {
      for (const [name, value] of Object.entries(opts.headers)) {
        form.append(`h:${name}`, value);
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}` },
        body: form,
      });
      const text = await res.text();
      if (res.ok) {
        let json: { id?: string } = {};
        try { json = JSON.parse(text); } catch { /* use empty */ }
        return {
          providerMessageId: json.id ? stripAngleBrackets(json.id) : null,
          error: null,
        };
      }
      return { providerMessageId: null, error: `${res.status} ${text}` };
    } catch (err) {
      return {
        providerMessageId: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  verifyWebhook(opts: VerifyOpts): boolean {
    // Mailgun embeds the signature inside the JSON body rather than headers;
    // the `headers` field in VerifyOpts is unused for Mailgun.
    let payload: unknown;
    try {
      payload = JSON.parse(opts.body);
    } catch {
      return false;
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('signature' in payload)
    ) return false;

    const sig = (payload as Record<string, unknown>).signature;
    if (
      typeof sig !== 'object' ||
      sig === null
    ) return false;

    const { timestamp, token, signature } = sig as Record<string, unknown>;
    if (
      typeof timestamp !== 'string' ||
      typeof token !== 'string' ||
      typeof signature !== 'string' ||
      !timestamp ||
      !token ||
      !signature
    ) return false;

    const tolerance = opts.tolerance ?? 300;
    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) return false;
    if (Math.abs(Date.now() / 1000 - tsNum) > tolerance) return false;

    const computed = createHmac('sha256', opts.secret)
      .update(`${timestamp}${token}`)
      .digest('hex');

    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;

    try { return timingSafeEqual(a, b); } catch { return false; }
  }

  parseEvent(body: string): NormalizedEvent {
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return { type: 'other', providerMessageId: null, rawType: '', receivedAt: new Date() };
    }

    const eventData = (payload as Record<string, unknown>)?.['event-data'];
    if (typeof eventData !== 'object' || eventData === null) {
      return { type: 'other', providerMessageId: null, rawType: '', receivedAt: new Date() };
    }

    const data = eventData as Record<string, unknown>;
    const rawType = typeof data.event === 'string' ? data.event : '';
    const type: NormalizedEventType = EVENT_TYPE_MAP[rawType] ?? 'other';

    // Extract message-id and strip angle brackets (Mailgun wraps it in <...>)
    const messageHeaders = (data.message as Record<string, unknown> | undefined)
      ?.headers as Record<string, unknown> | undefined;
    const rawMessageId = messageHeaders?.['message-id'];
    const providerMessageId =
      typeof rawMessageId === 'string'
        ? stripAngleBrackets(rawMessageId)
        : null;

    const tsRaw = data.timestamp;
    const receivedAt =
      typeof tsRaw === 'number'
        ? new Date(tsRaw * 1000)
        : new Date();

    return { type, providerMessageId, rawType, receivedAt };
  }
}
