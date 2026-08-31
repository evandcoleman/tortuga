import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { createLogger } from '@/kernel/logging/logger';
import {
  getTemplateBySlug,
  updateTemplate,
  deleteTemplate,
  UndeletableTemplateError,
} from '@/modules/templates/service';
import { updateTemplateSchema, firstIssueMessage } from '@/modules/templates/validation';

export const dynamic = 'force-dynamic';

const log = createLogger('api.templates.slug');

interface RouteParams {
  params: Promise<{ slug: string }>;
}

async function authorize(): Promise<NextResponse | null> {
  try {
    await requireAdminSession();
    return null;
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }
}

export async function GET(_req: Request, { params }: RouteParams) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const ctx = getAppContext();
  const template = getTemplateBySlug(ctx.db, slug);
  if (!template) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
  }

  const ctx = getAppContext();
  const template = updateTemplate(ctx.db, slug, parsed.data);
  if (!template) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const ctx = getAppContext();
  try {
    const deleted = deleteTemplate(ctx.db, slug);
    if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof UndeletableTemplateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    log.error({ err }, 'template delete failed');
    return NextResponse.json({ error: 'template delete failed' }, { status: 500 });
  }
}
