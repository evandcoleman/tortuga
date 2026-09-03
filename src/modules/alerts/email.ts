import { and, eq, isNull, lt } from 'drizzle-orm';

import type { Db } from '@/kernel/db/client';
import type { EmailProvider } from '@/kernel/email/types';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { createLogger } from '@/kernel/logging/logger';
import { renderTemplate } from '@/modules/templates/render';

import { alerts, type Alert } from './schema';

const log = createLogger('alerts.email');

const MAX_EMAIL_ATTEMPTS = 3;

export type AlertEmailConfig = Pick<NewsletterConfig, 'from' | 'reply_to' | 'theme' | 'appearance'>;

export interface EmailPendingAlertsDeps {
  db: Db;
  provider: EmailProvider | null;
  config: AlertEmailConfig;
  appUrl: string;
  adminEmail: string | null;
}

export interface EmailPendingAlertsResult {
  emailed: number;
  skipped: number;
}

// Logged once per process so a persistently unconfigured admin email/provider
// doesn't spam the log every sweep tick.
let warnedUnconfigured = false;

export function absoluteHref(appUrl: string, href: string | null): string | null {
  if (!href) return null;
  const base = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${base}${path}`;
}

function alertLine(appUrl: string, alert: Alert): string {
  const link = absoluteHref(appUrl, alert.href);
  const detail = alert.detail ? `: ${alert.detail}` : '';
  const linkSuffix = link ? ` ([Open](${link}))` : '';
  return `- **${alert.title}**${detail}${linkSuffix}`;
}

function buildBody(appUrl: string, pending: Alert[]): string {
  return pending.map(alert => alertLine(appUrl, alert)).join('\n');
}

/**
 * Selects alerts pending email (`emailed_at IS NULL`, under the attempt
 * cap), and if any exist, batches them into a single transactional message
 * to the admin. Never throws: a missing admin email/provider or a provider
 * failure is logged and reflected in the result, not raised.
 */
export async function emailPendingAlerts(deps: EmailPendingAlertsDeps, now: Date = new Date()): Promise<EmailPendingAlertsResult> {
  const pending = deps.db.select().from(alerts)
    .where(and(isNull(alerts.emailedAt), lt(alerts.emailAttempts, MAX_EMAIL_ATTEMPTS)))
    .all();

  if (pending.length === 0) {
    return { emailed: 0, skipped: 0 };
  }

  if (!deps.adminEmail || !deps.provider) {
    if (!warnedUnconfigured) {
      log.warn('admin email or email provider not configured; alerts remain visible on the dashboard only');
      warnedUnconfigured = true;
    }
    return { emailed: 0, skipped: pending.length };
  }

  const rendered = await renderTemplate(
    { subject: `[Tortuga] ${pending.length} new alert(s)`, body: buildBody(deps.appUrl, pending) },
    {
      vars: { name: null, email: deps.adminEmail, serverName: deps.config.from.name },
      appName: deps.config.from.name,
      themeId: deps.config.theme,
      appearance: deps.config.appearance,
    },
  );

  const result = await deps.provider.send({
    from: deps.config.from,
    to: deps.adminEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: deps.config.reply_to,
  });

  if (result.error) {
    log.error({ err: result.error }, 'failed to send admin alert digest email');
    incrementAttempts(deps.db, pending, now);
    return { emailed: 0, skipped: pending.length };
  }

  markEmailed(deps.db, pending, now);
  return { emailed: pending.length, skipped: 0 };
}

function incrementAttempts(db: Db, pending: Alert[], now: Date): void {
  for (const alert of pending) {
    db.update(alerts)
      .set({ emailAttempts: alert.emailAttempts + 1, updatedAt: now })
      .where(eq(alerts.id, alert.id))
      .run();
  }
}

function markEmailed(db: Db, pending: Alert[], now: Date): void {
  for (const alert of pending) {
    db.update(alerts)
      .set({ emailedAt: now })
      .where(eq(alerts.id, alert.id))
      .run();
  }
}
