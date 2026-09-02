import { getAppContext } from '@/kernel/context';
import { seedDefaultTemplates } from './seed';

/** Seeds the default templates (welcome plus the library) on startup. Idempotent — safe to call every boot. */
export function registerTemplatesModule() {
  const ctx = getAppContext();
  seedDefaultTemplates(ctx.db);
}
