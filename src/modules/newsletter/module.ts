import { getAppContext } from '@/kernel/context';
import { runDigest } from './pipeline/run';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('newsletter.module');

export function registerNewsletterModule() {
  const ctx = getAppContext();
  ctx.scheduler.register({
    name: 'newsletter.digest',
    cron: ctx.config.newsletter.schedule,
    timezone: ctx.config.newsletter.timezone,
    handler: async () => {
      log.info('scheduled digest firing');
      await runDigest({
        db: ctx.db, tautulli: ctx.tautulli, tmdb: ctx.tmdb, provider: ctx.email,
        config: ctx.config.newsletter,
        appUrl: ctx.env.APP_URL,
        sessionSecret: ctx.env.SESSION_SECRET,
        scheduledAt: new Date(),
      });
    },
  });
}
