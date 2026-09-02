import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getAppContext } from '@/kernel/context';
import { sendEvents, sends } from '@/modules/newsletter/schema';
import { suppressRecipientForSend } from '@/modules/newsletter/suppression';
import { createLogger } from '@/kernel/logging/logger';
import { readServiceSettings } from '@/kernel/config/service-settings';

export const dynamic = 'force-dynamic';
const log = createLogger('webhook.resend');

const TERMINAL_TYPES = new Set(['delivered', 'bounced', 'complained', 'failed']);

export async function POST(req: Request) {
  const ctx = getAppContext();
  const email = ctx.email;
  if (!email || email.name !== 'resend') {
    return NextResponse.json({ error: 'resend webhooks not enabled for this deploy' }, { status: 404 });
  }
  const body = await req.text();
  const secret = readServiceSettings(ctx.db, ctx.env)['resend.webhook_secret'].value ?? '';
  if (!secret) {
    log.warn('webhook received but RESEND_WEBHOOK_SECRET unset');
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
      provider: 'resend',
      type: event.rawType,
      receivedAt: event.receivedAt,
      payload: body,
    }).run();
    if (event.providerMessageId && TERMINAL_TYPES.has(event.type)) {
      ctx.db.update(sends).set({ status: event.type as 'delivered' | 'bounced' | 'complained' | 'failed' })
        .where(and(eq(sends.providerMessageId, event.providerMessageId), eq(sends.provider, 'resend')))
        .run();
    }
    // Missing/unknown bounce subtype is treated as non-fatal (do not suppress).
    const shouldSuppress = event.type === 'complained'
      || (event.type === 'bounced' && event.bounceType === 'permanent');
    if (event.providerMessageId && shouldSuppress) {
      const reason = event.type === 'complained' ? 'complaint' : 'bounce';
      suppressRecipientForSend(ctx.db, { provider: 'resend', providerMessageId: event.providerMessageId, reason });
    }
  } catch (err) {
    log.error({ err }, 'failed to process resend webhook payload');
    return NextResponse.json({ error: 'malformed payload' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
