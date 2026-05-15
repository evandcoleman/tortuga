import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getAppContext } from '@/kernel/context';
import { ResendProvider } from '@/kernel/email/resend';
import { sendEvents, sends } from '@/modules/newsletter/schema';
import { createLogger } from '@/kernel/logging/logger';

export const dynamic = 'force-dynamic';
const log = createLogger('webhook.resend');
const TERMINAL: Record<string, 'delivered' | 'bounced' | 'complained' | 'failed'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export async function POST(req: Request) {
  const ctx = getAppContext();
  const body = await req.text();
  const secret = ctx.env.RESEND_WEBHOOK_SECRET ?? '';
  if (!secret) {
    log.warn('webhook received but RESEND_WEBHOOK_SECRET unset');
    return NextResponse.json({ error: 'not configured' }, { status: 401 });
  }
  const provider = new ResendProvider({ apiKey: ctx.env.RESEND_API_KEY ?? '' });
  if (!provider.verifyWebhook({ body, headers: req.headers, secret })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  const payload = JSON.parse(body) as { type: string; data?: { email_id?: string } };
  const resendMessageId = payload.data?.email_id ?? '';
  ctx.db.insert(sendEvents).values({
    id: createId(), sendId: null, resendMessageId, type: payload.type,
    receivedAt: new Date(), payload: body,
  }).run();
  const terminal = TERMINAL[payload.type];
  if (terminal && resendMessageId) {
    ctx.db.update(sends).set({ status: terminal })
      .where(eq(sends.resendMessageId, resendMessageId)).run();
  }
  return NextResponse.json({ ok: true });
}
