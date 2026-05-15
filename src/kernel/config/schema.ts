import { z } from 'zod';

export const EnvSchema = z.object({
  TAUTULLI_URL: z.string().url(),
  TAUTULLI_API_KEY: z.string().min(1),
  TMDB_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  APP_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  AUTH_MODE: z.enum(['forward', 'session']).default('session'),
  AUTH_FORWARD_HEADER: z.string().default('Remote-User'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  DATABASE_URL: z.string().default('file:/config/tortuga.db'),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  MAILGUN_API_KEY: z.string().min(1).optional(),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
  DIGEST_RUN_TOKEN: z.string().min(16).optional(),
  LOG_LEVEL: z.string().default('info'),
  CONFIG_PATH: z.string().default('/config/tortuga.yml'),
});
export type Env = z.infer<typeof EnvSchema>;

export const NewsletterConfigSchema = z.object({
  schedule: z.string().default('0 9 * * SUN'),
  timezone: z.string().default('America/New_York'),
  lookback_days: z.number().int().positive().default(7),
  email: z.object({
    provider: z.enum(['resend', 'mailgun']).default('resend'),
    mailgun: z.object({
      domain: z.string().min(1),
      region: z.enum(['us', 'eu']).default('us'),
    }).optional(),
  }).superRefine((val, ctx) => {
    if (val.provider === 'mailgun' && !val.mailgun?.domain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'newsletter.email.mailgun.domain is required when provider=mailgun',
        path: ['mailgun', 'domain'],
      });
    }
  }).default(() => ({ provider: 'resend' as const })),
  from: z.object({ email: z.string().email(), name: z.string() }),
  reply_to: z.string().email().optional(),
  include_libraries: z.array(z.string()).nullish(),
  filters: z.object({
    min_tmdb_rating: z.number().min(0).max(10).default(0),
    dedupe_episodes_into_seasons: z.boolean().default(true),
    max_items_per_section: z.number().int().positive().default(12),
    exclude_genres: z.array(z.string()).default([]),
  }).default(() => ({
    min_tmdb_rating: 0,
    dedupe_episodes_into_seasons: true,
    max_items_per_section: 12,
    exclude_genres: [],
  })),
  featured: z.object({ enabled: z.boolean().default(false) }).default(() => ({ enabled: false })),
});
export type NewsletterConfig = z.infer<typeof NewsletterConfigSchema>;

export const YamlConfigSchema = z.object({ newsletter: NewsletterConfigSchema });
export type YamlConfig = z.infer<typeof YamlConfigSchema>;
