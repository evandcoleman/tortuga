import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { getTemplateBySlug } from '@/modules/templates/service';
import { renderTemplate } from '@/modules/templates/render';
import { previewTemplateSchema, firstIssueMessage } from '@/modules/templates/validation';

export const dynamic = 'force-dynamic';

const PREVIEW_EMAIL = 'preview@tortuga.local';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const { slug } = await params;
  const ctx = getAppContext();
  const template = getTemplateBySlug(ctx.db, slug);
  if (!template) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = previewTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
  }

  const rendered = await renderTemplate(
    {
      subject: parsed.data.subject ?? template.subject,
      body: parsed.data.body ?? template.body,
    },
    {
      vars: {
        name: parsed.data.name ?? null,
        email: parsed.data.email ?? PREVIEW_EMAIL,
        serverName: ctx.config.newsletter.from.name,
      },
      appName: ctx.config.newsletter.from.name,
      themeId: ctx.config.newsletter.theme,
      appearance: ctx.config.newsletter.appearance,
    },
  );

  return NextResponse.json(rendered);
}
