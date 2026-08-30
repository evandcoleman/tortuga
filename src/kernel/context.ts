import { loadEnv, loadYamlConfig } from './config/load';
import type { Env, YamlConfig } from './config/schema';
import { createDb, type Db } from './db/client';
import { applyMigrations } from './db/migrate';
import { createTautulliClient, type TautulliClient } from './integrations/tautulli';
import { createTmdbClient, type TmdbClient } from './integrations/tmdb';
import { createMaintainerrClient, type MaintainerrClient } from './integrations/maintainerr';
import { createScheduler, type Scheduler } from './scheduler/scheduler';
import { createLogger } from './logging/logger';
import { createEmailProvider } from './email/factory';
import type { EmailProvider } from './email/types';
import { resolveLlmClient, type LlmClient } from './integrations/llm';
import { readConfigOverride } from './config/overrides';
import { readServiceSettings } from './config/service-settings';

export interface AppContext {
  env: Env;
  config: YamlConfig;
  db: Db;
  tautulli: TautulliClient | null;
  tmdb: TmdbClient | null;
  maintainerr?: MaintainerrClient;
  email: EmailProvider | null;
  llm: LlmClient | null;
  scheduler: Scheduler;
}

let cached: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cached) return cached;
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  applyMigrations(db);
  const newsletter = readConfigOverride(db) ?? loadYamlConfig(env.CONFIG_PATH).newsletter;
  const config: YamlConfig = { newsletter };
  if (env.AUTH_MODE === 'session' && env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    // dynamic import to keep argon2 out of edge runtimes
    import('./auth/bootstrap').then(({ bootstrapAdminUser }) =>
      bootstrapAdminUser(db, { email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! })
    ).catch(err => createLogger('context').error({ err }, 'admin bootstrap failed'));
  }
  const settings = readServiceSettings(db, env);
  const tautulliUrl = settings['tautulli.url'].value;
  const tautulliApiKey = settings['tautulli.api_key'].value;
  const tautulli = tautulliUrl && tautulliApiKey
    ? createTautulliClient({ url: tautulliUrl, apiKey: tautulliApiKey })
    : null;
  const tmdbApiKey = settings['tmdb.api_key'].value;
  const tmdb = tmdbApiKey ? createTmdbClient({ apiKey: tmdbApiKey }) : null;
  const maintainerrUrl = settings['maintainerr.url'].value;
  const maintainerr = maintainerrUrl ? createMaintainerrClient({ url: maintainerrUrl }) : undefined;
  const email = createEmailProvider(
    {
      resendApiKey: settings['resend.api_key'].value,
      resendWebhookSecret: settings['resend.webhook_secret'].value,
      mailgunApiKey: settings['mailgun.api_key'].value,
      mailgunWebhookSigningKey: settings['mailgun.webhook_signing_key'].value,
    },
    config.newsletter.email,
  );
  const llm = resolveLlmClient(
    { anthropicApiKey: settings['anthropic.api_key'].value, openaiApiKey: settings['openai.api_key'].value },
    config.newsletter,
  );
  const scheduler = createScheduler();
  cached = { env, config, db, tautulli, tmdb, maintainerr, email, llm, scheduler };
  return cached;
}

// Reload the singleton in-process. Only correct because the Nomad job runs count=1
// (no second replica holds a stale cache). Stops old cron timers before rebuilding,
// then re-registers modules so the scheduler reflects new schedule/timezone/enabled.
export async function invalidateAppContext(): Promise<void> {
  const prior = cached;
  prior?.scheduler.stopAll();
  cached = null;
  try {
    getAppContext();
    const { registerAllModules } = await import('@/modules'); // lazy: avoid circular import
    registerAllModules();
  } catch (err) {
    // Rebuild failed — restore the prior context so the app keeps a working
    // singleton + scheduler rather than running degraded with none.
    cached = prior;
    throw err;
  }
}

export function resetAppContextForTests() {
  if (cached) cached.scheduler.stopAll();
  cached = null;
}
