import { createId } from '@paralleldrive/cuid2';
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
 *
 * Uses `ON CONFLICT DO NOTHING` instead of select-then-insert: concurrent
 * boots (e.g. multiple app instances starting at once) can otherwise race
 * between the existence check and the insert and throw an unhandled unique
 * constraint error on `templates.slug`.
 */
export function seedWelcomeTemplate(db: Db): void {
  const now = new Date();
  db.insert(templates)
    .values({
      id: createId(),
      slug: WELCOME_TEMPLATE_SLUG,
      name: WELCOME_TEMPLATE_NAME,
      subject: WELCOME_TEMPLATE_SUBJECT,
      body: WELCOME_TEMPLATE_BODY,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
}
