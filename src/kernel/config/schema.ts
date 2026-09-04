import { z } from 'zod';
import { AppearanceSchema, ThemeOverridesSchema } from '@/modules/newsletter/appearance/schema';

/** An optional secret env var: a blanked-out value (e.g. `FOO=""`) is treated as unset. */
const optionalSecret = z.union([z.literal('').transform(() => undefined), z.string().min(1)]).optional();

/** Default human-readable label for the newsletter's request link (matches portal copy). */
export const DEFAULT_REQUEST_LABEL = 'Make a request';

export const EnvSchema = z.object({
  TAUTULLI_URL: z.union([z.literal('').transform(() => undefined), z.string().url()]).optional(),
  TAUTULLI_API_KEY: optionalSecret,
  TMDB_API_KEY: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  APP_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  AUTH_MODE: z.enum(['forward', 'session']).default('session'),
  AUTH_FORWARD_HEADER: z.string().default('Remote-User'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  DATABASE_URL: z.string().default('file:/config/tortuga.db'),
  RESEND_WEBHOOK_SECRET: optionalSecret,
  MAILGUN_API_KEY: optionalSecret,
  MAILGUN_WEBHOOK_SIGNING_KEY: optionalSecret,
  DIGEST_RUN_TOKEN: z.string().min(16).optional(),
  LOG_LEVEL: z.string().default('info'),
  CONFIG_PATH: z.string().default('/config/tortuga.yml'),
  ANTHROPIC_API_KEY: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  MAINTAINERR_URL: z.union([z.literal('').transform(() => undefined), z.string().url()]).optional(),
  PLEX_TOKEN: optionalSecret,
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
    /** Optional cap on the leaving-soon section; unset (undefined) means uncapped. */
    max_items_leaving_soon: z.number().int().positive().optional(),
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
    request_label: z.string().default(DEFAULT_REQUEST_LABEL),
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

// ---------------------------------------------------------------------------
// Portal config — see docs/specs/2026-08-31-user-portal.md
// ---------------------------------------------------------------------------

/** Paths reserved by the app itself; custom portal page slugs may not collide with these. */
export const PORTAL_RESERVED_SLUGS = new Set([
  'getting-started', 'rules', 'report-issue', 'portal', 'issues', 'api', '_next',
]);

const portalSlugSchema = z.string()
  .regex(/^[a-z0-9-]+$/, 'slug must match ^[a-z0-9-]+$')
  .refine((slug) => !PORTAL_RESERVED_SLUGS.has(slug), { message: 'slug is reserved' });

export const PortalCustomLinkSchema = z.object({
  type: z.literal('link'),
  label: z.string().min(1),
  url: z.string().url(),
  description: z.string().max(140).optional(),
  hidden: z.boolean().optional(),
}).strict();

export const PortalCustomPageSchema = z.object({
  type: z.literal('page'),
  slug: portalSlugSchema,
  label: z.string().min(1),
  markdown: z.string().optional(),
  html: z.string().optional(),
  description: z.string().max(140).optional(),
  hidden: z.boolean().optional(),
}).strict();

export const PortalCustomEntrySchema = z.discriminatedUnion('type', [
  PortalCustomLinkSchema,
  PortalCustomPageSchema,
]);
export type PortalCustomEntry = z.infer<typeof PortalCustomEntrySchema>;

/** The three built-in content pages an `entries` row may point at via `builtin_page`. */
export const PORTAL_BUILTIN_PAGES = ['getting_started', 'rules', 'report_issue'] as const;
/** The three built-in external/derived links an `entries` row may point at via `builtin_link`. */
export const PORTAL_BUILTIN_LINKS = ['plex', 'request', 'status'] as const;

export const PortalBuiltinPageEntrySchema = z.object({
  type: z.literal('builtin_page'),
  page: z.enum(PORTAL_BUILTIN_PAGES),
  label: z.string().min(1).optional(),
  description: z.string().max(140).optional(),
  hidden: z.boolean().optional(),
}).strict();

export const PortalBuiltinLinkEntrySchema = z.object({
  type: z.literal('builtin_link'),
  link: z.enum(PORTAL_BUILTIN_LINKS),
  label: z.string().min(1).optional(),
  description: z.string().max(140).optional(),
  hidden: z.boolean().optional(),
}).strict();

export const PortalEntrySchema = z.discriminatedUnion('type', [
  PortalBuiltinPageEntrySchema,
  PortalBuiltinLinkEntrySchema,
  PortalCustomLinkSchema,
  PortalCustomPageSchema,
]);
export type PortalEntry = z.infer<typeof PortalEntrySchema>;

/** `page`-type entries must set exactly one of markdown/html, and custom slugs must be unique within the list. */
function validatePageEntryRules(entries: readonly PortalEntry[], ctx: z.RefinementCtx): void {
  const seenSlugs = new Set<string>();
  entries.forEach((entry, idx) => {
    if (entry.type !== 'page') return;
    const hasMarkdown = typeof entry.markdown === 'string' && entry.markdown.length > 0;
    const hasHtml = typeof entry.html === 'string' && entry.html.length > 0;
    if (hasMarkdown === hasHtml) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'custom page entries must set exactly one of markdown or html',
        path: [idx, hasMarkdown ? 'html' : 'markdown'],
      });
    }
    if (seenSlugs.has(entry.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate custom page slug: ${entry.slug}`,
        path: [idx, 'slug'],
      });
    }
    seenSlugs.add(entry.slug);
  });
}

/** Each built-in page/link may appear at most once across an entry list. */
function validateBuiltinEntryRules(entries: readonly PortalEntry[], ctx: z.RefinementCtx): void {
  const seenPages = new Set<string>();
  const seenLinks = new Set<string>();
  entries.forEach((entry, idx) => {
    if (entry.type === 'builtin_page') {
      if (seenPages.has(entry.page)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate built-in page entry: ${entry.page}`,
          path: [idx, 'page'],
        });
      }
      seenPages.add(entry.page);
    } else if (entry.type === 'builtin_link') {
      if (seenLinks.has(entry.link)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate built-in link entry: ${entry.link}`,
          path: [idx, 'link'],
        });
      }
      seenLinks.add(entry.link);
    }
  });
}

const PortalCustomListSchema = z.array(PortalCustomEntrySchema)
  .default([])
  .superRefine(validatePageEntryRules);

/** The ordered home-index list. Absent means "use the default six built-ins" (see `resolvePortalConfig`). */
const PortalEntryListSchema = z.array(PortalEntrySchema)
  .superRefine((entries, ctx) => {
    validatePageEntryRules(entries, ctx);
    validateBuiltinEntryRules(entries, ctx);
  })
  .optional();

export const PortalPageConfigSchema = z.object({
  enabled: z.boolean().default(true),
  markdown: z.string().nullish(),
  title: z.string().min(1).max(80).optional(),
  eyebrow: z.string().min(1).max(80).optional(),
}).strict();
const defaultPortalPage = () => ({ enabled: true, markdown: null });

/** Chrome copy shown around the portal — see docs/specs/2026-09-01-portal-copy-and-index.md §3. Every string is optional; unset falls back to today's hard-coded text at resolution time. */
export const PortalCopySchema = z.object({
  tagline: z.string().max(160).optional(),
  intro: z.string().max(400).optional(),
  tab_title: z.string().max(160).optional(),
  toc_heading: z.string().max(80).optional(),
  stuck_title: z.string().max(80).optional(),
  stuck_body: z.string().max(300).optional(),
  stuck_link_label: z.string().max(80).optional(),
  back_label: z.string().max(80).optional(),
  footer: z.string().max(160).optional(),
  custom_page_eyebrow: z.string().max(80).optional(),
  show_stuck_card: z.boolean().default(true),
  show_footer: z.boolean().default(true),
}).strict();
export type PortalCopy = z.infer<typeof PortalCopySchema>;
const defaultPortalCopy = () => ({ show_stuck_card: true, show_footer: true });

/**
 * Portal-specific appearance: a preset theme id plus overrides, mirroring the
 * newsletter's `theme` + `appearance.theme_overrides` pair. Distinct from the
 * newsletter's `AppearanceSchema` because the portal has its own web design
 * (button grid, prose pages) and does not reuse email-shell concepts like
 * `blocks`/`libraries`/`item_display`.
 */
export const PortalAppearanceSchema = z.object({
  theme: z.string().min(1).optional(),
  theme_overrides: ThemeOverridesSchema.optional(),
}).strict();
export type PortalAppearance = z.infer<typeof PortalAppearanceSchema>;

export const PortalLinksSchema = z.object({
  plex_url: z.string().url().default('https://app.plex.tv'),
  request_url: z.string().url().optional(),
  request_label: z.string().min(1).optional(),
  status_url: z.string().url().optional(),
}).strict();

export const PortalConfigSchema = z.object({
  enabled: z.boolean().default(false),
  domain: z.string().min(1).optional(),
  links: PortalLinksSchema.default(() => ({ plex_url: 'https://app.plex.tv' })),
  pages: z.object({
    getting_started: PortalPageConfigSchema.default(defaultPortalPage),
    rules: PortalPageConfigSchema.default(defaultPortalPage),
    report_issue: PortalPageConfigSchema.default(defaultPortalPage),
  }).strict().default(() => ({
    getting_started: defaultPortalPage(),
    rules: defaultPortalPage(),
    report_issue: defaultPortalPage(),
  })),
  custom: PortalCustomListSchema,
  entries: PortalEntryListSchema,
  copy: PortalCopySchema.default(defaultPortalCopy),
  appearance: PortalAppearanceSchema.optional(),
}).strict();
export type PortalConfig = z.infer<typeof PortalConfigSchema>;

export const YamlConfigSchema = z.object({
  newsletter: NewsletterConfigSchema,
  portal: PortalConfigSchema.default(() => PortalConfigSchema.parse({})),
});
export type YamlConfig = z.infer<typeof YamlConfigSchema>;
