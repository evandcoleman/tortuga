import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAppContext } from '@/kernel/context';
import { createLogger } from '@/kernel/logging/logger';
import { verifyPreferencesToken } from '@/kernel/email/preferences-token';
import { htmlPage } from '@/kernel/email/html-page';
import { recipientsCache } from '@/modules/newsletter/schema';
import { getPreferences, upsertPreferences, type Preferences } from '@/modules/preferences/repo';

export const dynamic = 'force-dynamic';

const log = createLogger('preferences');

const INVALID_TOKEN_RESPONSE = () => new NextResponse(
  htmlPage('Link no longer valid', '<p>This preferences link is invalid or has expired. Ask for a fresh email to get a new one.</p>'),
  { status: 400, headers: { 'content-type': 'text/html' } },
);

const SUPPRESSED_RESPONSE = () => new NextResponse(
  htmlPage(
    'Preferences unavailable',
    '<p>Email to this address was disabled after a delivery problem. Contact the server admin to have it re-enabled.</p>',
  ),
  { status: 200, headers: { 'content-type': 'text/html' } },
);

const SAVE_FAILED_RESPONSE = () => new NextResponse(
  htmlPage('Something went wrong', '<p>Your preferences could not be saved. Please try again later.</p>'),
  { status: 500, headers: { 'content-type': 'text/html' } },
);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderForm(token: string, prefs: Preferences, includeLibraries: string[], saved: boolean): string {
  const checkedFor = (lib: string) => prefs.libraries === null || prefs.libraries.includes(lib);
  const libraryFields = includeLibraries.map(lib => `
    <label><input type="checkbox" name="library" value="${escapeHtml(lib)}"${checkedFor(lib) ? ' checked' : ''}> ${escapeHtml(lib)}</label>`).join('');

  return `
  ${saved ? '<p class="saved">Preferences saved.</p>' : ''}
  <form method="post" action="/preferences">
    <input type="hidden" name="token" value="${escapeHtml(token)}">
    <label><input type="checkbox" name="digest"${prefs.digest ? ' checked' : ''}> Weekly digest</label>
    <label><input type="checkbox" name="announcements"${prefs.announcements ? ' checked' : ''}> Announcements</label>
    ${libraryFields}
    <button type="submit">Save preferences</button>
  </form>`;
}

/** Verifies the token and returns the recipient email, or `null` if invalid/expired. */
function verifyRequest(token: string, secret: string): string | null {
  const verified = verifyPreferencesToken(token, secret);
  return verified ? verified.email : null;
}

function isSuppressed(ctx: ReturnType<typeof getAppContext>, email: string): boolean {
  const recipient = ctx.db.select().from(recipientsCache).where(eq(recipientsCache.email, email)).get();
  return recipient !== undefined && recipient.active === false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const ctx = getAppContext();

  const email = verifyRequest(token, ctx.env.SESSION_SECRET);
  if (!email) return INVALID_TOKEN_RESPONSE();
  if (isSuppressed(ctx, email)) return SUPPRESSED_RESPONSE();

  const prefs = getPreferences(ctx.db, email);
  const includeLibraries = ctx.config.newsletter.include_libraries ?? [];
  return new NextResponse(htmlPage('Manage preferences', renderForm(token, prefs, includeLibraries, false)), {
    headers: { 'content-type': 'text/html' },
  });
}

function buildBodySchema(includeLibraries: string[]) {
  return z.object({
    token: z.string().min(1),
    digest: z.string().optional(),
    announcements: z.string().optional(),
    library: z.array(z.string().refine(v => includeLibraries.includes(v))).default([]),
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const ctx = getAppContext();
  const includeLibraries = ctx.config.newsletter.include_libraries ?? [];

  const raw = {
    token: form.get('token') ?? '',
    digest: form.has('digest') ? 'on' : undefined,
    announcements: form.has('announcements') ? 'on' : undefined,
    library: form.getAll('library').map(String),
  };
  const parsed = buildBodySchema(includeLibraries).safeParse(raw);
  if (!parsed.success) {
    return new NextResponse(
      htmlPage('Invalid request', '<p>One or more selected libraries are not recognized.</p>'),
      { status: 400, headers: { 'content-type': 'text/html' } },
    );
  }

  const email = verifyRequest(parsed.data.token, ctx.env.SESSION_SECRET);
  if (!email) return INVALID_TOKEN_RESPONSE();
  if (isSuppressed(ctx, email)) return SUPPRESSED_RESPONSE();

  const selected = parsed.data.library;
  const allSelected = includeLibraries.length === 0
    || (selected.length === includeLibraries.length && includeLibraries.every(lib => selected.includes(lib)));

  try {
    const prefs = upsertPreferences(ctx.db, email, {
      digest: parsed.data.digest === 'on',
      announcements: parsed.data.announcements === 'on',
      libraries: allSelected ? null : selected,
    });
    return new NextResponse(htmlPage('Manage preferences', renderForm(parsed.data.token, prefs, includeLibraries, true)), {
      headers: { 'content-type': 'text/html' },
    });
  } catch (err) {
    log.error({ err, email }, 'failed to save preferences');
    return SAVE_FAILED_RESPONSE();
  }
}
