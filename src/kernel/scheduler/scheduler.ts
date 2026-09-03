import { Cron } from 'croner';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('scheduler');

export interface ScheduleSpec {
  name: string;
  cron: string;
  timezone: string;
  handler: () => Promise<void> | void;
}

export type SchedulerErrorListener = (name: string, err: unknown) => void;

export function createScheduler() {
  const jobs = new Map<string, { spec: ScheduleSpec; cron: Cron }>();
  const errorListeners: SchedulerErrorListener[] = [];

  function notifyListeners(name: string, err: unknown) {
    for (const listener of errorListeners) {
      // Each listener runs in its own try/catch so a broken listener can
      // never mask the original error or stop the remaining listeners.
      try {
        listener(name, err);
      } catch (listenerErr) {
        log.error({ schedule: name, err: listenerErr }, 'scheduler error listener threw');
      }
    }
  }

  return {
    register(spec: ScheduleSpec) {
      if (jobs.has(spec.name)) throw new Error(`duplicate schedule: ${spec.name}`);
      const cron = new Cron(
        spec.cron,
        {
          timezone: spec.timezone,
          // Prevents a slow-running handler from overlapping with the next tick
          // (e.g. a duplicate digest send if a run is still in progress).
          protect: () => {
            log.warn({ schedule: spec.name }, 'skipped scheduled tick: previous run still in progress');
          },
        },
        async () => {
          try { await spec.handler(); }
          catch (err) {
            log.error({ schedule: spec.name, err }, 'scheduled handler threw');
            notifyListeners(spec.name, err);
          }
        },
      );
      jobs.set(spec.name, { spec, cron });
    },
    onError(listener: SchedulerErrorListener) {
      errorListeners.push(listener);
    },
    /** Manually runs a job's underlying cron trigger now, awaiting completion. Used by tests. */
    async trigger(name: string) {
      const job = jobs.get(name);
      if (!job) return;
      await job.cron.trigger();
    },
    stop(name: string) {
      const job = jobs.get(name);
      if (!job) return;
      job.cron.stop();
      jobs.delete(name);
    },
    stopAll() {
      for (const { cron } of jobs.values()) cron.stop();
      jobs.clear();
    },
    list() {
      return Array.from(jobs.values()).map(({ spec, cron }) => ({
        name: spec.name, cron: spec.cron, nextRun: cron.nextRun(),
      }));
    },
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;
