import { NextResponse } from 'next/server';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession, UnauthorizedError } from '@/kernel/auth/require-admin-session';
import { createLogger } from '@/kernel/logging/logger';
import { listTemplates, createTemplate, DuplicateSlugError } from '@/modules/templates/service';
import { createTemplateSchema, firstIssueMessage } from '@/modules/templates/validation';

export const dynamic = 'force-dynamic';

const log = createLogger('api.templates');

export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const ctx = getAppContext();
  const rows = listTemplates(ctx.db);
  return NextResponse.json({ templates: rows });
}

export async function POST(req: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
  }

  const ctx = getAppContext();
  try {
    const template = createTemplate(ctx.db, parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateSlugError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    log.error({ err }, 'template create failed');
    return NextResponse.json({ error: 'template create failed' }, { status: 500 });
  }
}
