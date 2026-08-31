import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';

import { templates } from './schema';
import {
  WELCOME_TEMPLATE_SLUG,
  WELCOME_TEMPLATE_NAME,
  WELCOME_TEMPLATE_SUBJECT,
  WELCOME_TEMPLATE_BODY,
} from './welcome-content';

/**
 * Seeds the default `welcome` template on first run. Idempotent: never
 * touches an existing row, so admin edits to the welcome template survive
 * every restart.
 */
export function seedWelcomeTemplate(db: Db): void {
  const existing = db.select().from(templates).where(eq(templates.slug, WELCOME_TEMPLATE_SLUG)).get();
  if (existing) return;

  const now = new Date();
  db.insert(templates).values({
    id: createId(),
    slug: WELCOME_TEMPLATE_SLUG,
    name: WELCOME_TEMPLATE_NAME,
    subject: WELCOME_TEMPLATE_SUBJECT,
    body: WELCOME_TEMPLATE_BODY,
    createdAt: now,
    updatedAt: now,
  }).run();
}
