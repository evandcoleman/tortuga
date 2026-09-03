import type { Db } from '@/kernel/db/client';
import { createLogger } from '@/kernel/logging/logger';

import { sweepAlerts, upsertAlert, type SweepAlertsResult } from './sweep';
import { schedulerErrorCandidate } from './conditions';
import { emailPendingAlerts, type EmailPendingAlertsDeps, type EmailPendingAlertsResult } from './email';

const log = createLogger('alerts.tick');

const SWEEP_SCHEDULE_NAME = 'alerts.sweep';

export interface RunAlertsTickDeps extends EmailPendingAlertsDeps {
  db: Db;
  /** Overridable for tests; defaults to the real `sweepAlerts`. */
  sweep?: (db: Db, options: { now: Date; timezone: string }) => SweepAlertsResult;
}

export interface RunAlertsTickOptions {
  now: Date;
  timezone: string;
}

/**
 * Runs one alerts tick: sweep for new alert conditions, then always send the
 * batched admin email — even if the sweep itself threw. A sweep failure is
 * recorded as a `scheduler_error` alert first, so the same tick that catches
 * the failure is the one that emails it, rather than waiting for the next
 * scheduler `onError` callback to race the email step.
 */
export async function runAlertsTick(deps: RunAlertsTickDeps, options: RunAlertsTickOptions): Promise<EmailPendingAlertsResult> {
  const sweep = deps.sweep ?? sweepAlerts;
  try {
    sweep(deps.db, options);
  } catch (err) {
    log.error({ err }, 'alerts sweep threw');
    const candidate = schedulerErrorCandidate(SWEEP_SCHEDULE_NAME, err, options);
    upsertAlert(deps.db, candidate, options.now);
  }

  return emailPendingAlerts(deps, options.now);
}
