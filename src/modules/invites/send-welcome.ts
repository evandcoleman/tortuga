import type { Db } from '@/kernel/db/client';
import type { EmailProvider } from '@/kernel/email/types';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { getTemplateBySlug } from '@/modules/templates/service';
import { renderTemplate } from '@/modules/templates/render';
import { WELCOME_TEMPLATE_SLUG } from '@/modules/templates/welcome-content';

/** The subset of NewsletterConfig the welcome email needs. */
export type WelcomeEmailConfig = Pick<NewsletterConfig, 'from' | 'theme' | 'appearance'>;

export interface SendWelcomeDeps {
  db: Db;
  provider: EmailProvider;
  config: WelcomeEmailConfig;
}

export interface SendWelcomeInput {
  email: string;
  /** Recipient's real name, when known (e.g. from recipientsCache). Falls back to the email local part. */
  name?: string | null;
}

export type SendWelcomeResult = { ok: true } | { ok: false; error: string };

/**
 * Renders the `welcome` template and sends it directly via the configured
 * provider — deliberately bypassing `deliverToRecipients`/announcements'
 * unsubscribe plumbing. This is a transactional send: no unsubscribe token,
 * no `List-Unsubscribe` headers, and no `sends`/`digests` row.
 */
export async function sendWelcomeEmail(deps: SendWelcomeDeps, input: SendWelcomeInput): Promise<SendWelcomeResult> {
  const template = getTemplateBySlug(deps.db, WELCOME_TEMPLATE_SLUG);
  if (!template) {
    return { ok: false, error: 'the welcome template is missing (it should be seeded on startup)' };
  }

  let html: string;
  let subject: string;
  let text: string;
  try {
    const rendered = await renderTemplate(
      { subject: template.subject, body: template.body },
      {
        vars: { name: input.name ?? null, email: input.email, serverName: deps.config.from.name },
        appName: deps.config.from.name,
        themeId: deps.config.theme,
        appearance: deps.config.appearance,
      },
    );
    html = rendered.html;
    subject = rendered.subject;
    text = rendered.text;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'welcome email render failed' };
  }

  try {
    const result = await deps.provider.send({
      from: deps.config.from,
      to: input.email,
      subject,
      html,
      text,
    });
    if (result.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'welcome email send failed' };
  }
}
