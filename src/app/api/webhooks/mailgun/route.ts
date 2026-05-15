import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getAppContext } from '@/kernel/context';
import { sendEvents, sends } from '@/modules/newsletter/schema';
import { createLogger } from '@/kernel/logging/logger';

export const dynamic = 'force-dynamic';
const log = createLogger('webhook.mailgun');

const TERMINAL_TYPES = new Set(['delivered', 'bounced', 'complained', 'failed']);

export async function POST(req: Request) {
  const ctx = getAppContext();
  if (ctx.email.name !== 'mailgun') {
    return NextResponse.json({ error: 'mailgun webhooks not enabled for this deploy' }, { status: 404 });
  }
  const body = await req.text();
  const secret = ctx.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!secret) {
    log.warn('webhook received but MAILGUN_WEBHOOK_SIGNING_KEY unset');
    return NextResponse.json({ error: 'not configured' }, { status: 401 });
  }
  if (!ctx.email.verifyWebhook({ body, headers: req.headers, secret })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  const event = ctx.email.parseEvent(body);
  ctx.db.insert(sendEvents).values({
    id: createId(),
    sendId: null,
    providerMessageId: event.providerMessageId ?? '',
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
  return NextResponse.json({ ok: true });
}
