import { z } from 'zod';
import { AppearanceSchema } from '@/modules/newsletter/appearance/schema';

export const EnvSchema = z.object({
  TAUTULLI_URL: z.union([z.literal('').transform(() => undefined), z.string().url()]).optional(),
  TAUTULLI_API_KEY: z.string().min(1).optional(),
  TMDB_API_KEY: z.string().min(1).optional(),
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
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  MAINTAINERR_URL: z.union([z.literal('').transform(() => undefined), z.string().url()]).optional(),
});
export type Env = z.infer<typeof EnvSchema>;

export const NewsletterConfigSchema = z.object({
  schedule: z.string().default('0 9 * * SUN'),
  schedule_enabled: z.boolean().default(true),
  timezone: z.string().default('America/New_York').refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, { message: 'Invalid IANA timezone' }),
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
  theme: z.string().default('editorial'),
  layout: z.string().default('list'),
  appearance: AppearanceSchema.optional(),
  plex: z.object({
    server_id: z.string().min(1),
  }).optional(),
  commentary: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['anthropic', 'openai']).default('anthropic'),
    model: z.string().default(''),
    voice: z.string().default(''),
    disclaimer: z.boolean().default(false),
  }).default(() => ({ enabled: false, provider: 'anthropic' as const, model: '', voice: '', disclaimer: false })),
  extras: z.object({
    request_url: z.string().url().optional(),
    request_label: z.string().default('Request a title'),
    personal_url: z.string().url().optional(),
    personal_label: z.string().optional(),
    freeform_markdown: z.string().optional(),
  }).optional(),
  leaving: z.object({
    enabled: z.boolean().default(true),
    days: z.number().int().min(1).max(90).default(7),
    excluded_collection_ids: z.array(z.number()).default([]),
    heading: z.string().min(1).max(80).default('Leaving soon'),
  }).default(() => ({
    enabled: true, days: 7, excluded_collection_ids: [], heading: 'Leaving soon',
  })),
});
export type NewsletterConfig = z.infer<typeof NewsletterConfigSchema>;

export const YamlConfigSchema = z.object({ newsletter: NewsletterConfigSchema });
export type YamlConfig = z.infer<typeof YamlConfigSchema>;
