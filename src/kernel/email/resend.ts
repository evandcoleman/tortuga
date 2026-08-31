import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import type {
  BounceType,
  EmailProvider,
  EmailSendOpts,
  EmailSendResult,
  NormalizedEvent,
  NormalizedEventType,
  VerifyOpts,
} from './types';

const EVENT_TYPE_MAP: Record<string, NormalizedEventType> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

// Resend's raw `data.bounce.type` values, mapped to our normalized classification.
const BOUNCE_TYPE_MAP: Record<string, BounceType> = {
  Permanent: 'permanent',
  Transient: 'transient',
  Undetermined: 'undetermined',
};

export class ResendProvider implements EmailProvider {
  readonly name = 'resend' as const;

  private readonly client: Resend;

  constructor(private readonly opts: { apiKey: string; webhookSecret?: string }) {
    this.client = new Resend(opts.apiKey);
  }

  async send(opts: EmailSendOpts): Promise<EmailSendResult> {
    const res = await this.client.emails.send({
      from: `${opts.from.name} <${opts.from.email}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      headers: opts.headers,
    });
    return {
      providerMessageId: res.data?.id ?? null,
      error: res.error?.message ?? null,
    };
  }

  verifyWebhook(opts: VerifyOpts): boolean {
    const header = opts.headers.get('Resend-Signature');
    if (!header) return false;
    const parts = Object.fromEntries(
      header.split(',').map(s => s.trim().split('=', 2)).filter(p => p.length === 2),
    ) as Record<string, string>;
    const ts = parts.t;
    const sig = parts.v1;
    if (!ts || !sig) return false;
    const tolerance = opts.tolerance ?? 300;
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    if (Math.abs(Date.now() / 1000 - tsNum) > tolerance) return false;
    const computed = createHmac('sha256', opts.secret).update(`${ts}.${opts.body}`).digest('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length) return false;
    try { return timingSafeEqual(a, b); } catch { return false; }
  }

  parseEvent(body: string): NormalizedEvent {
    let payload: { type?: string; data?: { email_id?: string; bounce?: { type?: string } } };
    try {
      payload = JSON.parse(body) as {
        type?: string;
        data?: { email_id?: string; bounce?: { type?: string } };
      };
    } catch {
      return { type: 'other', providerMessageId: null, rawType: '', receivedAt: new Date() };
    }
    const rawType = payload.type ?? '';
    const type: NormalizedEventType = EVENT_TYPE_MAP[rawType] ?? 'other';
    const rawBounceType = payload.data?.bounce?.type;
    const bounceType = typeof rawBounceType === 'string' ? BOUNCE_TYPE_MAP[rawBounceType] : undefined;
    return {
      type,
      providerMessageId: payload.data?.email_id ?? null,
      rawType,
      receivedAt: new Date(),
      ...(bounceType ? { bounceType } : {}),
    };
  }
}
