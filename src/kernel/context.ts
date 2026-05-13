import { loadEnv, loadYamlConfig } from './config/load';
import type { Env, YamlConfig } from './config/schema';
import { createDb, type Db } from './db/client';
import { applyMigrations } from './db/migrate';
import { createTautulliClient, type TautulliClient } from './integrations/tautulli';
import { createTmdbClient, type TmdbClient } from './integrations/tmdb';
import { createResendClient } from './integrations/resend';
import { createScheduler, type Scheduler } from './scheduler/scheduler';
import { Resend } from 'resend';

export interface AppContext {
  env: Env;
  config: YamlConfig;
  db: Db;
  tautulli: TautulliClient;
  tmdb: TmdbClient;
  resend: Resend;
  scheduler: Scheduler;
}

let cached: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cached) return cached;
  const env = loadEnv();
  const config = loadYamlConfig(env.CONFIG_PATH);
  const db = createDb(env.DATABASE_URL);
  applyMigrations(db);
  const tautulli = createTautulliClient({ url: env.TAUTULLI_URL, apiKey: env.TAUTULLI_API_KEY });
  const tmdb = createTmdbClient({ apiKey: env.TMDB_API_KEY });
  const resend = createResendClient(env.RESEND_API_KEY);
  const scheduler = createScheduler();
  cached = { env, config, db, tautulli, tmdb, resend, scheduler };
  return cached;
}

export function resetAppContextForTests() {
  cached = null;
}
