import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { runDigest } from '@/modules/newsletter/pipeline/run';
import { digests } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

async function generate() {
  'use server';
  const ctx = getAppContext();
  await runDigest({
    db: ctx.db,
    tautulli: ctx.tautulli,
    tmdb: ctx.tmdb,
    resend: ctx.resend,
    config: ctx.config.newsletter,
    appUrl: ctx.env.APP_URL,
    sessionSecret: ctx.env.SESSION_SECRET,
    scheduledAt: new Date(),
    dryRun: true,
  });
  revalidatePath('/newsletter/preview');
}

async function send() {
  'use server';
  const ctx = getAppContext();
  await runDigest({
    db: ctx.db,
    tautulli: ctx.tautulli,
    tmdb: ctx.tmdb,
    resend: ctx.resend,
    config: ctx.config.newsletter,
    appUrl: ctx.env.APP_URL,
    sessionSecret: ctx.env.SESSION_SECRET,
    scheduledAt: new Date(),
  });
  revalidatePath('/newsletter/preview');
  revalidatePath('/newsletter/history');
}

export default function Preview() {
  const ctx = getAppContext();
  const latest = ctx.db
    .select()
    .from(digests)
    .where(eq(digests.status, 'rendered'))
    .orderBy(desc(digests.scheduledAt))
    .limit(1)
    .all();
  const html = latest[0]?.renderedHtml ?? '';
  return (
    <div>
      <h2>Preview</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <form action={generate}>
          <button type="submit">Generate fresh preview</button>
        </form>
        <form action={send}>
          <button type="submit" style={{ background: '#4f7cff', color: '#fff' }}>
            Send now
          </button>
        </form>
      </div>
      {html ? (
        <iframe
          srcDoc={html}
          style={{
            width: '100%',
            height: 800,
            background: '#fff',
            border: '1px solid #1e242e',
            borderRadius: 8,
          }}
        />
      ) : (
        <p>No preview rendered yet. Click &quot;Generate fresh preview&quot;.</p>
      )}
    </div>
  );
}
