import { Cron } from 'croner';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('scheduler');

export interface ScheduleSpec {
  name: string;
  cron: string;
  timezone: string;
  handler: () => Promise<void> | void;
}

export function createScheduler() {
  const jobs = new Map<string, { spec: ScheduleSpec; cron: Cron }>();
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
          catch (err) { log.error({ schedule: spec.name, err }, 'scheduled handler threw'); }
        },
      );
      jobs.set(spec.name, { spec, cron });
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
