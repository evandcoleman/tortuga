import type { NewsletterConfig } from '@/kernel/config/schema';
import type { EmailProvider } from './types';
import { ResendProvider } from './resend';
import { MailgunProvider } from './mailgun';

/** Effective (env-or-db resolved) credentials for whichever email provider is selected. */
export interface EmailProviderSettings {
  resendApiKey?: string;
  resendWebhookSecret?: string;
  mailgunApiKey?: string;
  mailgunWebhookSigningKey?: string;
}

/**
 * Builds the configured email provider from resolved settings. Returns null — rather than
 * throwing — when the selected provider's credentials are incomplete, so a missing/rotated
 * key never crashes app boot; callers treat null as "email is not configured".
 */
export function createEmailProvider(
  settings: EmailProviderSettings,
  cfg: NewsletterConfig['email'],
): EmailProvider | null {
  if (cfg.provider === 'mailgun') {
    if (!settings.mailgunApiKey || !settings.mailgunWebhookSigningKey || !cfg.mailgun?.domain) return null;
    return new MailgunProvider({
      apiKey: settings.mailgunApiKey,
      webhookSigningKey: settings.mailgunWebhookSigningKey,
      domain: cfg.mailgun.domain,
      region: cfg.mailgun.region,
    });
  }
  if (!settings.resendApiKey) return null;
  return new ResendProvider({
    apiKey: settings.resendApiKey,
    webhookSecret: settings.resendWebhookSecret,
  });
}
