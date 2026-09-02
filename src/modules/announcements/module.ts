import { getAppContext } from '@/kernel/context';
import { createLogger } from '@/kernel/logging/logger';
import { runDueAnnouncements } from './pipeline/run-due';
import type { AnnouncementSendConfig } from './pipeline/send';

const log = createLogger('announcements.module');

/**
 * Polls once a minute for due scheduled announcements and sends them. Not
 * gated by `newsletter.schedule_enabled` — that flag governs the digest
 * only, not announcements.
 */
export function registerAnnouncementsModule() {
  const ctx = getAppContext();
  ctx.scheduler.register({
    name: 'announcements.scheduled',
    cron: '* * * * *',
    timezone: ctx.config.newsletter.timezone,
    handler: async () => {
      if (!ctx.email) {
        log.warn('email provider not configured; leaving scheduled announcements untouched');
        return;
      }
      const config: AnnouncementSendConfig = ctx.config.newsletter;
      await runDueAnnouncements({
        db: ctx.db,
        provider: ctx.email,
        config,
        appUrl: ctx.env.APP_URL,
        sessionSecret: ctx.env.SESSION_SECRET,
      });
    },
  });
}
