'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAppContext, invalidateAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { writeServiceSettings, readServiceSettings, type ServiceSettingKey } from '@/kernel/config/service-settings';
import {
  testTautulliConnection,
  testTmdbConnection,
  testMaintainerrConnection,
  testAnthropicConnection,
  testOpenaiConnection,
  type ConnectionTestResult,
} from '@/kernel/integrations/connection-tests';
import { secretPatch, urlPatch } from '../_lib/form-values';

export type ServiceSaveState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const urlSchema = z.string().url();

/** Returns a user-facing error when a submitted (non-untouched) URL patch fails validation. */
function urlPatchError(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return urlSchema.safeParse(value).success ? null : 'Enter a valid URL.';
}

async function persist(patch: Partial<Record<ServiceSettingKey, string | null | undefined>>): Promise<void> {
  const ctx = getAppContext();
  writeServiceSettings(ctx.db, patch, ctx.env);
  await invalidateAppContext();
  revalidatePath('/settings/services');
  revalidatePath('/');
}

export async function saveTautulliSettings(_prev: ServiceSaveState, fd: FormData): Promise<ServiceSaveState> {
  await requireAdminSession();
  const url = urlPatch(fd, 'tautulli.url');
  const error = urlPatchError(url);
  if (error) return { status: 'error', message: error };
  await persist({ 'tautulli.url': url, 'tautulli.api_key': secretPatch(fd, 'tautulli.api_key') });
  return { status: 'success' };
}

export async function saveTmdbSettings(_prev: ServiceSaveState, fd: FormData): Promise<ServiceSaveState> {
  await requireAdminSession();
  await persist({ 'tmdb.api_key': secretPatch(fd, 'tmdb.api_key') });
  return { status: 'success' };
}

export async function saveMaintainerrSettings(_prev: ServiceSaveState, fd: FormData): Promise<ServiceSaveState> {
  await requireAdminSession();
  const url = urlPatch(fd, 'maintainerr.url');
  const error = urlPatchError(url);
  if (error) return { status: 'error', message: error };
  await persist({ 'maintainerr.url': url });
  return { status: 'success' };
}

export async function saveAnthropicSettings(_prev: ServiceSaveState, fd: FormData): Promise<ServiceSaveState> {
  await requireAdminSession();
  await persist({ 'anthropic.api_key': secretPatch(fd, 'anthropic.api_key') });
  return { status: 'success' };
}

export async function saveOpenaiSettings(_prev: ServiceSaveState, fd: FormData): Promise<ServiceSaveState> {
  await requireAdminSession();
  await persist({ 'openai.api_key': secretPatch(fd, 'openai.api_key') });
  return { status: 'success' };
}

export async function testTautulli(): Promise<ConnectionTestResult> {
  await requireAdminSession();
  const ctx = getAppContext();
  const settings = readServiceSettings(ctx.db, ctx.env);
  const url = settings['tautulli.url'].value;
  const apiKey = settings['tautulli.api_key'].value;
  if (!url || !apiKey) return { ok: false, message: 'Tautulli is not fully configured.' };
  return testTautulliConnection(url, apiKey);
}

export async function testTmdb(): Promise<ConnectionTestResult> {
  await requireAdminSession();
  const ctx = getAppContext();
  const apiKey = readServiceSettings(ctx.db, ctx.env)['tmdb.api_key'].value;
  if (!apiKey) return { ok: false, message: 'TMDB API key is not configured.' };
  return testTmdbConnection(apiKey);
}

export async function testMaintainerr(): Promise<ConnectionTestResult> {
  await requireAdminSession();
  const ctx = getAppContext();
  const url = readServiceSettings(ctx.db, ctx.env)['maintainerr.url'].value;
  if (!url) return { ok: false, message: 'Maintainerr URL is not configured.' };
  return testMaintainerrConnection(url);
}

export async function testAnthropic(): Promise<ConnectionTestResult> {
  await requireAdminSession();
  const ctx = getAppContext();
  const apiKey = readServiceSettings(ctx.db, ctx.env)['anthropic.api_key'].value;
  if (!apiKey) return { ok: false, message: 'Anthropic API key is not configured.' };
  return testAnthropicConnection(apiKey);
}

export async function testOpenai(): Promise<ConnectionTestResult> {
  await requireAdminSession();
  const ctx = getAppContext();
  const apiKey = readServiceSettings(ctx.db, ctx.env)['openai.api_key'].value;
  if (!apiKey) return { ok: false, message: 'OpenAI API key is not configured.' };
  return testOpenaiConnection(apiKey);
}
