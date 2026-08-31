import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { render } from '@react-email/render';
import { createElement } from 'react';

import type { Db } from '@/kernel/db/client';
import type { TautulliClient } from '@/kernel/integrations/tautulli';
import type { TmdbClient } from '@/kernel/integrations/tmdb';
import type { MaintainerrClient } from '@/kernel/integrations/maintainerr';
import type { EmailProvider } from '@/kernel/email/types';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';
import { deliverToRecipients } from '@/kernel/email/deliver';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { ServiceNotConfiguredError } from '@/kernel/config/service-settings';
import { createLogger } from '@/kernel/logging/logger';

import { digests, recipientsCache } from '../schema';
import type { EnrichedItem } from '../types';
import { applyFilters } from '../filters';
import { generateDigestSlug } from '../slug';
import { syncRecipients } from './recipients';
import { enrichItems } from './enrich';
import { fetchLeavingItems } from './leaving';
import { DigestEmail } from '../templates/digest';
import { THEMES } from '../templates/themes';
import { LAYOUTS } from '../templates/layouts';
import { setThemedPreviews } from './preview-cache';
import { marked } from 'marked';
import type { LlmClient } from '@/kernel/integrations/llm';
import type { DigestLink } from '../templates/digest';
import { generateIntro } from './commentary';

const log = createLogger('newsletter.run');

/**
 * Attaches a Plex deep-link `plexUrl` to every item that has a `ratingKey`,
 * when a Plex server id is configured. Shared by the main item list and the
 * leaving-soon list so both get the same "Open in Plex" behaviour.
 */
function withPlexLinks<T extends EnrichedItem>(items: T[], serverId: string | undefined): T[] {
  return items.map(it => {
    if (!serverId || !it.ratingKey) return it;
    const key = encodeURIComponent(`/library/metadata/${it.ratingKey}`);
    return {
      ...it,
      plexUrl: `https://app.plex.tv/desktop/#!/server/${serverId}/details?key=${key}`,
    };
  });
}

export interface RunDigestOpts {
  db: Db;
  tautulli: TautulliClient | null;
  tmdb: TmdbClient | null;
  maintainerr?: MaintainerrClient;
  provider: EmailProvider | null;
  config: NewsletterConfig;
  appUrl: string;
  sessionSecret: string;
  scheduledAt: Date;
  dryRun?: boolean;
  recipientFilter?: (email: string) => boolean;
  llm?: LlmClient | null;
  cacheThemedPreviews?: boolean;
}

export async function runDigest(opts: RunDigestOpts) {
  const digestId = createId();
  const slug = generateDigestSlug();
  const windowEnd = opts.scheduledAt;
  const windowStart = new Date(windowEnd.getTime() - opts.config.lookback_days * 86_400_000);
  opts.db.insert(digests).values({
    id: digestId, scheduledAt: opts.scheduledAt, windowStart, windowEnd,
    status: 'pending', itemCount: 0, slug,
  }).run();

  try {
    if (!opts.tautulli) throw new ServiceNotConfiguredError('tautulli', 'Tautulli is not configured');
    if (!opts.tmdb) throw new ServiceNotConfiguredError('tmdb', 'TMDB is not configured');
    if (!opts.provider) throw new ServiceNotConfiguredError('email', 'Email provider is not configured');
    if (opts.config.commentary?.enabled && !opts.llm) {
      const provider = opts.config.commentary.provider;
      throw new ServiceNotConfiguredError(provider, `newsletter.commentary is enabled but ${provider} is not configured`);
    }

    await syncRecipients(opts.db, opts.tautulli);

    const raw = await opts.tautulli.getRecentlyAdded({ since: windowStart, count: 200 });
    const enriched = await enrichItems(opts.db, opts.tmdb, raw);
    const filtered = applyFilters(enriched, opts.config.filters, opts.config.include_libraries ?? null);

    if (filtered.length === 0) {
      opts.db.update(digests).set({ status: 'skipped', ranAt: new Date(), itemCount: 0 })
        .where(eq(digests.id, digestId)).run();
      return { id: digestId, status: 'skipped' as const, itemCount: 0 };
    }

    let leavingItems: EnrichedItem[] = [];
    if (opts.maintainerr && opts.config.leaving.enabled) {
      try {
        const leavingRaw = await fetchLeavingItems(
          { maintainerr: opts.maintainerr, tautulli: opts.tautulli, log },
          {
            windowEnd,
            days: opts.config.leaving.days,
            excludedCollectionIds: opts.config.leaving.excluded_collection_ids,
          },
        );
        leavingItems = await enrichItems(opts.db, opts.tmdb, leavingRaw);
      } catch (err) {
        log.error({ digest_id: digestId, err }, 'leaving-soon fetch failed; continuing without it');
        leavingItems = [];
      }
    }

    const serverId = opts.config.plex?.server_id;
    const filteredWithPlexLinks = withPlexLinks(filtered, serverId);
    const leavingItemsWithPlexLinks = withPlexLinks(leavingItems, serverId);

    const intro = opts.llm
      ? await generateIntro(opts.llm, filteredWithPlexLinks, {
          appName: opts.config.from.name,
          voice: opts.config.commentary?.voice,
        })
      : null;

    const extras = opts.config.extras;
    const requestLink: DigestLink | undefined = extras?.request_url
      ? { url: extras.request_url, label: extras.request_label ?? 'Request a title' }
      : undefined;
    const personalLink: DigestLink | undefined = extras?.personal_url
      ? { url: extras.personal_url, label: extras.personal_label ?? new URL(extras.personal_url).host }
      : undefined;
    const freeformHtml = extras?.freeform_markdown
      ? (marked.parse(extras.freeform_markdown, { async: false }) as string)
      : undefined;

    const placeholderUnsub = generateUnsubscribeToken('preview@tortuga.local', opts.sessionSecret);
    const subject = `New on ${opts.config.from.name} — ${filtered.length} item${filtered.length === 1 ? '' : 's'}`;

    // Shared across every render (email and web) so the theme and disclaimer
    // are identical everywhere; only the unsubscribe token, caps, and issue
    // URL differ per variant/recipient.
    const baseEmailProps = {
      items: filteredWithPlexLinks,
      appName: opts.config.from.name,
      windowStart,
      windowEnd,
      intro: intro ?? undefined,
      disclaimer: opts.config.commentary?.disclaimer ?? false,
      themeId: opts.config.theme,
      layoutId: opts.config.layout,
      requestLink,
      personalLink,
      freeformHtml,
      appearance: opts.config.appearance,
      leavingItems: leavingItemsWithPlexLinks,
      leavingHeading: opts.config.leaving.heading,
      timezone: opts.config.timezone,
    };

    const issueUrl = `${opts.appUrl}/issues/${slug}`;
    // Email variant: per-section caps applied, links back to the full issue online.
    const emailProps = {
      ...baseEmailProps,
      limits: {
        perLibrarySection: opts.config.filters.max_items_per_section,
        leavingSoon: opts.config.filters.max_items_leaving_soon,
      },
      issueUrl,
    };

    const html = await render(
      createElement(DigestEmail, {
        ...emailProps,
        unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${placeholderUnsub}`,
      }),
    );
    // Web variant: no caps (every item), no unsubscribe link, no recipient-specific
    // content — an immutable snapshot served at the hosted issue URL.
    const webHtml = await render(createElement(DigestEmail, { ...baseEmailProps }));

    opts.db.update(digests).set({
      status: 'rendered', itemCount: filtered.length,
      renderedHtml: html, renderedSubject: subject, webHtml,
    }).where(eq(digests.id, digestId)).run();

    if (opts.cacheThemedPreviews) {
      const previews = [];
      for (const theme of Object.values(THEMES)) {
        for (const lay of Object.values(LAYOUTS)) {
          const comboHtml = await render(
            createElement(DigestEmail, {
              ...emailProps,
              unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${placeholderUnsub}`,
              themeId: theme.id,
              layoutId: lay.id,
            }),
          );
          previews.push({
            themeId: theme.id,
            themeLabel: theme.label,
            layoutId: lay.id,
            layoutLabel: lay.label,
            html: comboHtml,
          });
        }
      }
      setThemedPreviews({ digestId, previews });
    }

    if (opts.dryRun) {
      return { id: digestId, status: 'rendered' as const, itemCount: filtered.length };
    }

    opts.db.update(digests).set({ status: 'sending' }).where(eq(digests.id, digestId)).run();
    const recipients = opts.db.select().from(recipientsCache).all()
      .filter(r => r.active)
      .filter(r => !opts.recipientFilter || opts.recipientFilter(r.email));

    const { sent } = await deliverToRecipients(
      { db: opts.db, provider: opts.provider, appUrl: opts.appUrl, sessionSecret: opts.sessionSecret },
      {
        recipients: recipients.map(r => ({ email: r.email, name: r.name })),
        subject,
        from: opts.config.from,
        replyTo: opts.config.reply_to,
        renderFor: unsubscribeUrl => render(createElement(DigestEmail, { ...emailProps, unsubscribeUrl })),
        sendRow: { digestId },
        onRenderFailure: 'abort',
      },
    );
    const anySent = sent > 0;

    opts.db.update(digests).set({
      status: anySent ? 'sent' : 'failed', ranAt: new Date(),
    }).where(eq(digests.id, digestId)).run();

    return { id: digestId, status: anySent ? 'sent' as const : 'failed' as const, itemCount: filtered.length };
  } catch (err) {
    log.error({ digest_id: digestId, provider: opts.provider?.name, err }, 'digest run failed');
    opts.db.update(digests).set({
      status: 'failed', ranAt: new Date(),
      error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
    }).where(eq(digests.id, digestId)).run();
    throw err;
  }
}
