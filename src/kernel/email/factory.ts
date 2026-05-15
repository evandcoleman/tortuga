import type { Env, NewsletterConfig } from '@/kernel/config/schema';
import type { EmailProvider } from './types';
import { ResendProvider } from './resend';
import { MailgunProvider } from './mailgun';

export function createEmailProvider(
  env: Env,
  cfg: NewsletterConfig['email'],
): EmailProvider {
  if (cfg.provider === 'mailgun') {
    if (!env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY required when provider=mailgun');
    if (!env.MAILGUN_WEBHOOK_SIGNING_KEY) throw new Error('MAILGUN_WEBHOOK_SIGNING_KEY required when provider=mailgun');
    if (!cfg.mailgun?.domain) throw new Error('newsletter.email.mailgun.domain required when provider=mailgun');
    return new MailgunProvider({
      apiKey: env.MAILGUN_API_KEY,
      webhookSigningKey: env.MAILGUN_WEBHOOK_SIGNING_KEY,
      domain: cfg.mailgun.domain,
      region: cfg.mailgun.region,
    });
  }
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY required when provider=resend');
  return new ResendProvider({
    apiKey: env.RESEND_API_KEY,
    webhookSecret: env.RESEND_WEBHOOK_SECRET,
  });
}
