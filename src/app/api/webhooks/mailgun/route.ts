import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getAppContext } from '@/kernel/context';
import { sendEvents, sends } from '@/modules/newsletter/schema';
import { suppressRecipientForSend } from '@/modules/newsletter/suppression';
import { createLogger } from '@/kernel/logging/logger';
import { readServiceSettings } from '@/kernel/config/service-settings';

export const dynamic = 'force-dynamic';
const log = createLogger('webhook.mailgun');

const TERMINAL_TYPES = new Set(['delivered', 'bounced', 'complained', 'failed']);
// Mailgun's normalization already separates permanent failures ('bounced')
// from temporary ones (mapped to 'other'), so any 'bounced'/'complained'
// event here is a hard failure that should suppress the recipient.
const SUPPRESSING_TYPES = new Set(['bounced', 'complained']);

export async function POST(req: Request) {
  const ctx = getAppContext();
  const email = ctx.email;
  if (!email || email.name !== 'mailgun') {
    return NextResponse.json({ error: 'mailgun webhooks not enabled for this deploy' }, { status: 404 });
  }
  const body = await req.text();
  const secret = readServiceSettings(ctx.db, ctx.env)['mailgun.webhook_signing_key'].value;
  if (!secret) {
    log.warn('webhook received but MAILGUN_WEBHOOK_SIGNING_KEY unset');
    return NextResponse.json({ error: 'not configured' }, { status: 401 });
  }
  if (!email.verifyWebhook({ body, headers: req.headers, secret })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  try {
    const event = email.parseEvent(body);
    ctx.db.insert(sendEvents).values({
      id: createId(),
      sendId: null,
      providerMessageId: event.providerMessageId ?? null,
      provider: 'mailgun',
      type: event.rawType,
      receivedAt: event.receivedAt,
      payload: body,
    }).run();
    if (event.providerMessageId && TERMINAL_TYPES.has(event.type)) {
      ctx.db.update(sends).set({ status: event.type as 'delivered' | 'bounced' | 'complained' | 'failed' })
        .where(and(eq(sends.providerMessageId, event.providerMessageId), eq(sends.provider, 'mailgun')))
        .run();
    }
    if (event.providerMessageId && SUPPRESSING_TYPES.has(event.type)) {
      suppressRecipientForSend(ctx.db, { provider: 'mailgun', providerMessageId: event.providerMessageId });
    }
  } catch (err) {
    log.error({ err }, 'failed to process mailgun webhook payload');
    return NextResponse.json({ error: 'malformed payload' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
