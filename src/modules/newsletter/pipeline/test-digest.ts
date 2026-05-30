import { z } from 'zod';

import type { EmailProvider } from '@/kernel/email/types';
import type { Appearance } from '@/modules/newsletter/appearance/schema';
import { createLogger } from '@/kernel/logging/logger';

import { getThemedPreviews, type MatrixPreview } from './preview-cache';

const log = createLogger('newsletter.test-digest');

const emailSchema = z.string().trim().email();

export interface TestDigestOpts {
  /** The digest whose cached preview matrix should be used as the source. */
  digestId: string;
  /** Theme to send — must match a combination present in the preview matrix. */
  themeId: string;
  /** Layout to send — must match a combination present in the preview matrix. */
  layoutId: string;
  /** Recipient of the one-off test send. */
  toEmail: string;
  /** Subject line to use (reuses the rendered digest subject). */
  subject: string;
  /** Email provider used to dispatch the message. */
  provider: EmailProvider;
  /** Sender identity from newsletter config. */
  from: { email: string; name: string };
  /** Optional reply-to address from newsletter config. */
  replyTo?: string;
  /**
   * Appearance customization from newsletter config. The cached preview matrix
   * is already rendered with this applied (see runDigest), so it is accepted for
   * signature completeness and forward-compatibility rather than re-rendering.
   */
  appearance?: Appearance;
  /**
   * Lookup for the cached theme×layout preview matrix. Injectable for tests;
   * defaults to the in-process preview cache populated by runDigest.
   */
  lookupPreviews?: () => { digestId: string; previews: MatrixPreview[] } | null;
}

export interface TestDigestResult {
  success: boolean;
  error?: string;
}

/**
 * Render-and-send a one-off test digest to a single email address.
 *
 * Reuses the pre-rendered HTML from the dry-run preview matrix (one render per
 * theme×layout) rather than re-running the data pipeline, so the recipient sees
 * exactly the same HTML shown in the preview. Intentionally does NOT write to
 * the digests/sends tables — test sends are ephemeral and kept out of the audit
 * trail. Test sends are logged with a 'test_digest_send' marker for observability.
 */
export async function renderAndSendTestDigest(opts: TestDigestOpts): Promise<TestDigestResult> {
  const parsedEmail = emailSchema.safeParse(opts.toEmail);
  if (!parsedEmail.success) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  const toEmail = parsedEmail.data;

  const lookup = opts.lookupPreviews ?? getThemedPreviews;
  const cached = lookup();
  if (!cached || cached.digestId !== opts.digestId) {
    return { success: false, error: 'No preview available — generate a fresh preview first.' };
  }

  const match = cached.previews.find(
    p => p.themeId === opts.themeId && p.layoutId === opts.layoutId,
  );
  if (!match) {
    return { success: false, error: 'Selected theme and layout are no longer available.' };
  }

  try {
    const result = await opts.provider.send({
      from: opts.from,
      to: toEmail,
      subject: opts.subject,
      html: match.html,
      replyTo: opts.replyTo,
    });

    if (result.error) {
      log.warn(
        { test_digest_send: true, to: toEmail, themeId: opts.themeId, layoutId: opts.layoutId, err: result.error },
        'test digest send failed',
      );
      return { success: false, error: result.error };
    }

    log.info(
      {
        test_digest_send: true,
        to: toEmail,
        themeId: opts.themeId,
        layoutId: opts.layoutId,
        provider: opts.provider.name,
        providerMessageId: result.providerMessageId,
      },
      'test digest sent',
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error sending test digest.';
    log.error(
      { test_digest_send: true, to: toEmail, themeId: opts.themeId, layoutId: opts.layoutId, err },
      'test digest send threw',
    );
    return { success: false, error: message };
  }
}
