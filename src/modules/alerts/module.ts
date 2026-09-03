import { getAppContext } from '@/kernel/context';
import { sweepAlerts, upsertAlert } from './sweep';
import { schedulerErrorCandidate } from './conditions';
import { emailPendingAlerts, type AlertEmailConfig } from './email';

const SWEEP_SCHEDULE_NAME = 'alerts.sweep';

/**
 * Registers the once-a-minute sweep (which also triggers the batched admin
 * email for anything newly created) and the scheduler error listener that
 * turns any job's uncaught throw into a `scheduler_error` alert.
 */
export function registerAlertsModule() {
  const ctx = getAppContext();

  ctx.scheduler.register({
    name: SWEEP_SCHEDULE_NAME,
    cron: '* * * * *',
    timezone: ctx.config.newsletter.timezone,
    handler: async () => {
      sweepAlerts(ctx.db, { timezone: ctx.config.newsletter.timezone });
      const config: AlertEmailConfig = ctx.config.newsletter;
      await emailPendingAlerts({
        db: ctx.db,
        provider: ctx.email,
        config,
        appUrl: ctx.env.APP_URL,
        adminEmail: ctx.env.ADMIN_EMAIL ?? null,
      });
    },
  });

  ctx.scheduler.onError((name, err) => {
    const candidate = schedulerErrorCandidate(name, err, { now: new Date(), timezone: ctx.config.newsletter.timezone });
    upsertAlert(ctx.db, candidate, new Date());
  });
}
