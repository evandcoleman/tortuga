import { getAppContext } from '@/kernel/context';
import { upsertAlert } from './sweep';
import { schedulerErrorCandidate } from './conditions';
import { runAlertsTick } from './tick';
import type { AlertEmailConfig } from './email';

const SWEEP_SCHEDULE_NAME = 'alerts.sweep';

/**
 * Registers the once-a-minute sweep (which also triggers the batched admin
 * email for anything newly created, even if the sweep itself failed) and the
 * scheduler error listener that turns any *other* job's uncaught throw into
 * a `scheduler_error` alert.
 */
export function registerAlertsModule() {
  const ctx = getAppContext();

  ctx.scheduler.register({
    name: SWEEP_SCHEDULE_NAME,
    cron: '* * * * *',
    timezone: ctx.config.newsletter.timezone,
    handler: async () => {
      const config: AlertEmailConfig = ctx.config.newsletter;
      await runAlertsTick(
        {
          db: ctx.db,
          provider: ctx.email,
          config,
          appUrl: ctx.env.APP_URL,
          adminEmail: ctx.env.ADMIN_EMAIL ?? null,
        },
        { now: new Date(), timezone: ctx.config.newsletter.timezone },
      );
    },
  });

  ctx.scheduler.onError((name, err) => {
    const candidate = schedulerErrorCandidate(name, err, { now: new Date(), timezone: ctx.config.newsletter.timezone });
    upsertAlert(ctx.db, candidate, new Date());
  });
}
