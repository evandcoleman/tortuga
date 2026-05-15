export type ProviderName = 'resend' | 'mailgun';

export interface EmailSendOpts {
  from: { email: string; name: string };
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  providerMessageId: string | null;
  error: string | null;
}

export interface VerifyOpts {
  body: string;
  headers: Headers;
  secret: string;
  /** Max allowed age of the timestamp in seconds. Defaults to 300 (5 minutes). */
  tolerance?: number;
}

export type NormalizedEventType =
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'other';

export interface NormalizedEvent {
  type: NormalizedEventType;
  providerMessageId: string | null;
  rawType: string;
  receivedAt: Date;
}

export interface EmailProvider {
  name: ProviderName;
  send(opts: EmailSendOpts): Promise<EmailSendResult>;
  verifyWebhook(opts: VerifyOpts): boolean;
  parseEvent(body: string): NormalizedEvent;
}
