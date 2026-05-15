import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { render } from '@react-email/render';
import { createElement } from 'react';

import type { Db } from '@/kernel/db/client';
import type { TautulliClient } from '@/kernel/integrations/tautulli';
import type { TmdbClient } from '@/kernel/integrations/tmdb';
import type { EmailProvider } from '@/kernel/email/types';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';
import type { NewsletterConfig } from '@/kernel/config/schema';
import { createLogger } from '@/kernel/logging/logger';

import { digests, sends, recipientsCache, unsubscribes } from '../schema';
import { applyFilters } from '../filters';
import { syncRecipients } from './recipients';
import { enrichItems } from './enrich';
import { DigestEmail } from '../templates/digest';

const log = createLogger('newsletter.run');

export interface RunDigestOpts {
  db: Db;
  tautulli: TautulliClient;
  tmdb: TmdbClient;
  provider: EmailProvider;
  config: NewsletterConfig;
  appUrl: string;
  sessionSecret: string;
  scheduledAt: Date;
  dryRun?: boolean;
  recipientFilter?: (email: string) => boolean;
}

export async function runDigest(opts: RunDigestOpts) {
  const digestId = createId();
  const windowEnd = opts.scheduledAt;
  const windowStart = new Date(windowEnd.getTime() - opts.config.lookback_days * 86_400_000);
  opts.db.insert(digests).values({
    id: digestId, scheduledAt: opts.scheduledAt, windowStart, windowEnd,
    status: 'pending', itemCount: 0,
  }).run();

  try {
    await syncRecipients(opts.db, opts.tautulli);

    const raw = await opts.tautulli.getRecentlyAdded({ since: windowStart, count: 200 });
    const enriched = await enrichItems(opts.db, opts.tmdb, raw);
    const filtered = applyFilters(enriched, opts.config.filters, opts.config.include_libraries ?? null);

    if (filtered.length === 0) {
      opts.db.update(digests).set({ status: 'skipped', ranAt: new Date(), itemCount: 0 })
        .where(eq(digests.id, digestId)).run();
      return { id: digestId, status: 'skipped' as const, itemCount: 0 };
    }

    const placeholderUnsub = generateUnsubscribeToken('preview@tortuga.local', opts.sessionSecret);
    const subject = `New on ${opts.config.from.name} — ${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
    const html = await render(createElement(DigestEmail, {
      items: filtered,
      unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${placeholderUnsub}`,
      appName: opts.config.from.name,
    }));

    opts.db.update(digests).set({
      status: 'rendered', itemCount: filtered.length,
      renderedHtml: html, renderedSubject: subject,
    }).where(eq(digests.id, digestId)).run();

    if (opts.dryRun) {
      return { id: digestId, status: 'rendered' as const, itemCount: filtered.length };
    }

    opts.db.update(digests).set({ status: 'sending' }).where(eq(digests.id, digestId)).run();
    const recipients = opts.db.select().from(recipientsCache).all()
      .filter(r => r.active)
      .filter(r => !opts.recipientFilter || opts.recipientFilter(r.email));

    let anySent = false;
    for (const r of recipients) {
      const sendId = createId();
      const tokenStr = generateUnsubscribeToken(r.email, opts.sessionSecret);
      opts.db.insert(unsubscribes).values({ token: tokenStr, email: r.email, createdAt: new Date() }).run();
      const perRecipientHtml = await render(createElement(DigestEmail, {
        items: filtered,
        unsubscribeUrl: `${opts.appUrl}/api/unsubscribe?token=${tokenStr}`,
        appName: opts.config.from.name,
      }));
      opts.db.insert(sends).values({
        id: sendId, digestId, recipientEmail: r.email, recipientName: r.name, status: 'queued',
      }).run();
      try {
        const result = await opts.provider.send({
          from: opts.config.from,
          to: r.email,
          subject,
          html: perRecipientHtml,
          replyTo: opts.config.reply_to,
        });
        opts.db.update(sends).set({
          providerMessageId: result.providerMessageId,
          provider: opts.provider.name,
          status: result.error ? 'failed' : 'sent',
          sentAt: new Date(),
          error: result.error,
        }).where(eq(sends.id, sendId)).run();
        if (!result.error) anySent = true;
      } catch (e) {
        opts.db.update(sends).set({
          status: 'failed', error: e instanceof Error ? e.message : 'unknown', sentAt: new Date(),
        }).where(eq(sends.id, sendId)).run();
      }
    }

    opts.db.update(digests).set({
      status: anySent ? 'sent' : 'failed', ranAt: new Date(),
    }).where(eq(digests.id, digestId)).run();

    return { id: digestId, status: anySent ? 'sent' as const : 'failed' as const, itemCount: filtered.length };
  } catch (err) {
    log.error({ digest_id: digestId, provider: opts.provider.name, err }, 'digest run failed');
    opts.db.update(digests).set({
      status: 'failed', ranAt: new Date(),
      error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
    }).where(eq(digests.id, digestId)).run();
    throw err;
  }
}
