import { getAppContext } from '@/kernel/context';
import { seedWelcomeTemplate } from './seed';

/** Seeds the default `welcome` template on startup. Idempotent — safe to call every boot. */
export function registerTemplatesModule() {
  const ctx = getAppContext();
  seedWelcomeTemplate(ctx.db);
}
