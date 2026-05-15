import { loadEnv, loadYamlConfig } from './config/load';
import type { Env, YamlConfig } from './config/schema';
import { createDb, type Db } from './db/client';
import { applyMigrations } from './db/migrate';
import { createTautulliClient, type TautulliClient } from './integrations/tautulli';
import { createTmdbClient, type TmdbClient } from './integrations/tmdb';
import { createScheduler, type Scheduler } from './scheduler/scheduler';
import { createLogger } from './logging/logger';
import { createEmailProvider } from './email/factory';
import type { EmailProvider } from './email/types';

export interface AppContext {
  env: Env;
  config: YamlConfig;
  db: Db;
  tautulli: TautulliClient;
  tmdb: TmdbClient;
  email: EmailProvider;
  scheduler: Scheduler;
}

let cached: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cached) return cached;
  const env = loadEnv();
  const config = loadYamlConfig(env.CONFIG_PATH);
  const db = createDb(env.DATABASE_URL);
  applyMigrations(db);
  if (env.AUTH_MODE === 'session' && env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    // dynamic import to keep argon2 out of edge runtimes
    import('./auth/bootstrap').then(({ bootstrapAdminUser }) =>
      bootstrapAdminUser(db, { email: env.ADMIN_EMAIL!, password: env.ADMIN_PASSWORD! })
    ).catch(err => createLogger('context').error({ err }, 'admin bootstrap failed'));
  }
  const tautulli = createTautulliClient({ url: env.TAUTULLI_URL, apiKey: env.TAUTULLI_API_KEY });
  const tmdb = createTmdbClient({ apiKey: env.TMDB_API_KEY });
  const email = createEmailProvider(env, config.newsletter.email);
  const scheduler = createScheduler();
  cached = { env, config, db, tautulli, tmdb, email, scheduler };
  return cached;
}

export function resetAppContextForTests() {
  cached = null;
}
