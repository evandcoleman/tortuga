import type { NewsletterConfig } from '@/kernel/config/schema';
import type { ServiceSettingKey } from '@/kernel/config/service-settings';
import { mergeAndValidate, type ParseResult } from '../_lib/config-patch';
import { str, opt, secretPatch } from '../_lib/form-values';

export function parseEmailConfigForm(fd: FormData, current: NewsletterConfig): ParseResult {
  const provider = str(fd, 'email.provider') === 'mailgun' ? 'mailgun' : 'resend';
  const domain = str(fd, 'email.mailgun.domain');

  return mergeAndValidate(current, {
    email: {
      provider,
      // Include the mailgun sub-object whenever the domain field is populated, not just when
      // provider=mailgun — mergeAndValidate replaces `email` wholesale, so omitting it here would
      // silently wipe an already-configured mailgun domain/region when saving with provider=resend.
      ...(domain.length > 0
        ? {
            mailgun: {
              domain,
              region: str(fd, 'email.mailgun.region') === 'eu' ? ('eu' as const) : ('us' as const),
            },
          }
        : {}),
    },
    from: { email: str(fd, 'from.email'), name: str(fd, 'from.name') },
    reply_to: opt(str(fd, 'reply_to')),
  });
}

/** Resend/Mailgun credential fields, sourced from paired SecretField inputs. */
export function parseEmailSecretsForm(fd: FormData): Partial<Record<ServiceSettingKey, string | null | undefined>> {
  return {
    'resend.api_key': secretPatch(fd, 'resend.api_key'),
    'resend.webhook_secret': secretPatch(fd, 'resend.webhook_secret'),
    'mailgun.api_key': secretPatch(fd, 'mailgun.api_key'),
    'mailgun.webhook_signing_key': secretPatch(fd, 'mailgun.webhook_signing_key'),
  };
}
