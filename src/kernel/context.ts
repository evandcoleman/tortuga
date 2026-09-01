import { loadEnv, loadYamlConfig } from './config/load';
import { NewsletterConfigSchema, PortalConfigSchema, type Env, type YamlConfig } from './config/schema';
import { resolvePortalConfig, type ResolvedPortalConfig } from './config/portal';
import { createDb, type Db } from './db/client';
import { applyMigrations } from './db/migrate';
import { createTautulliClient, type TautulliClient } from './integrations/tautulli';
import { createTmdbClient, type TmdbClient } from './integrations/tmdb';
import { createMaintainerrClient, type MaintainerrClient } from './integrations/maintainerr';
import { createPlexClient, type PlexClient } from './integrations/plex';
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
  /** Non-null only when both PLEX_TOKEN and newsletter.plex.server_id are configured. */
  plex: PlexClient | null;
  email: EmailProvider | null;
  llm: LlmClient | null;
  scheduler: Scheduler;
  portal: ResolvedPortalConfig;
}

let cached: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cached) return cached;
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  applyMigrations(db);
  const yamlConfig = loadYamlConfig(env.CONFIG_PATH);
  const newsletter = readConfigOverride(db, 'newsletter', NewsletterConfigSchema) ?? yamlConfig.newsletter;
  const portalConfig = readConfigOverride(db, 'portal', PortalConfigSchema) ?? yamlConfig.portal;
  const config: YamlConfig = { newsletter, portal: portalConfig };
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
  const plexToken = settings['plex.token'].value;
  const plexServerId = config.newsletter.plex?.server_id;
  const plex = plexToken && plexServerId
    ? createPlexClient({ token: plexToken, machineId: plexServerId })
    : null;
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
  const portal = resolvePortalConfig(config.portal, config.newsletter.extras);
  cached = { env, config, db, tautulli, tmdb, maintainerr, plex, email, llm, scheduler, portal };
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

/**
 * Reads the portal `enabled`/`domain` fields fresh (DB override, falling back to
 * the YAML file) instead of from the cached `AppContext.portal` singleton.
 *
 * Next.js can bundle middleware into a separate module instance from the one
 * running server actions/route handlers, so `invalidateAppContext()` called
 * from a settings save/revert action may never be observed by middleware's own
 * copy of `cached`. Host routing is a security boundary (it decides whether
 * Authelia's forward-auth is bypassed), so it must not depend on that
 * cross-instance invalidation ever happening — this does a single DB row read
 * per call instead, reusing the existing override/YAML resolution helpers.
 */
/**
 * How long `getPortalHostConfigFresh()` may serve a memoized value before
 * re-reading the DB/YAML. This request-scoped guard now runs on every
 * request (including static assets), so a per-request DB read + YAML parse +
 * Zod validation would add unnecessary load; a short TTL keeps settings
 * changes visible within a few seconds without paying that cost per request.
 */
export const PORTAL_HOST_CONFIG_TTL_MS = 5_000;

let portalHostConfigMemo: { value: { enabled: boolean; domain?: string }; expiresAt: number } | null = null;

export function getPortalHostConfigFresh(): { enabled: boolean; domain?: string } {
  const now = Date.now();
  if (portalHostConfigMemo && now < portalHostConfigMemo.expiresAt) {
    return portalHostConfigMemo.value;
  }
  const ctx = getAppContext();
  const override = readConfigOverride(ctx.db, 'portal', PortalConfigSchema);
  const portal = override ?? loadYamlConfig(ctx.env.CONFIG_PATH).portal;
  const value = { enabled: portal.enabled, domain: portal.domain };
  portalHostConfigMemo = { value, expiresAt: now + PORTAL_HOST_CONFIG_TTL_MS };
  return value;
}

export function resetAppContextForTests() {
  if (cached) cached.scheduler.stopAll();
  cached = null;
  portalHostConfigMemo = null;
}
