'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeConfigOverride } from '@/kernel/config/overrides';
import { readServiceSettings, writeServiceSettings } from '@/kernel/config/service-settings';
import {
  testResendConnection,
  testMailgunConnection,
  type ConnectionTestResult,
} from '@/kernel/integrations/connection-tests';
import { parseEmailConfigForm, parseEmailSecretsForm } from './form-parse';

export type SaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errors: Record<string, string> };

export async function saveEmailSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdminSession();

  const ctx = getAppContext();
  const result = parseEmailConfigForm(formData, ctx.config.newsletter);
  if (!result.ok) return { status: 'error', errors: result.errors };

  writeConfigOverride(ctx.db, result.config);
  writeServiceSettings(ctx.db, parseEmailSecretsForm(formData), ctx.env);
  await invalidateAppContext();

  revalidatePath('/settings/email');
  revalidatePath('/');
  return { status: 'success' };
}

/** Pings Resend using the currently effective (env-or-db) API key. Never mutates state. */
export async function testResend(): Promise<ConnectionTestResult> {
  await requireAdminSession();

  const ctx = getAppContext();
  const settings = readServiceSettings(ctx.db, ctx.env);
  const apiKey = settings['resend.api_key'].value;
  if (!apiKey) return { ok: false, message: 'Resend API key is not configured.' };
  return testResendConnection(apiKey);
}

/** Pings Mailgun using the currently effective (env-or-db) API key. Never mutates state. */
export async function testMailgun(): Promise<ConnectionTestResult> {
  await requireAdminSession();

  const ctx = getAppContext();
  const settings = readServiceSettings(ctx.db, ctx.env);
  const apiKey = settings['mailgun.api_key'].value;
  if (!apiKey) return { ok: false, message: 'Mailgun API key is not configured.' };
  const region = ctx.config.newsletter.email.mailgun?.region ?? 'us';
  return testMailgunConnection(apiKey, region);
}
