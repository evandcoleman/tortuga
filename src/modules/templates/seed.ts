import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';

import { templates, templateSeeds } from './schema';
import {
  WELCOME_TEMPLATE_SLUG,
  WELCOME_TEMPLATE_NAME,
  WELCOME_TEMPLATE_SUBJECT,
  WELCOME_TEMPLATE_BODY,
} from './welcome-content';
import { LIBRARY_TEMPLATES, type LibraryTemplateContent } from './library-content';

/** The full set of templates seeded on boot: welcome plus the library. */
export const DEFAULT_TEMPLATES: readonly LibraryTemplateContent[] = [
  {
    slug: WELCOME_TEMPLATE_SLUG,
    name: WELCOME_TEMPLATE_NAME,
    subject: WELCOME_TEMPLATE_SUBJECT,
    body: WELCOME_TEMPLATE_BODY,
  },
  ...LIBRARY_TEMPLATES,
];

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

/**
 * Seeds each library template exactly once, tracked via `template_seeds`.
 * Unlike `seedWelcomeTemplate`, a library template that's deleted by an
 * admin does not come back on the next boot: the seed row survives the
 * template row's deletion, so the skip check still finds it.
 */
function seedLibraryTemplate(db: Db, template: LibraryTemplateContent): void {
  const alreadySeeded = db
    .select()
    .from(templateSeeds)
    .where(eq(templateSeeds.slug, template.slug))
    .get();
  if (alreadySeeded) return;

  const now = new Date();
  db.transaction((tx) => {
    tx.insert(templates)
      .values({
        id: createId(),
        slug: template.slug,
        name: template.name,
        subject: template.subject,
        body: template.body,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    tx.insert(templateSeeds)
      .values({ slug: template.slug, seededAt: now })
      .run();
  });
}

/**
 * Seeds the welcome template plus every library template on boot. Welcome
 * keeps its own `ON CONFLICT DO NOTHING` semantics and is not tracked in
 * `template_seeds`. Library templates are one-shot per slug: seeding skips
 * a slug once a `template_seeds` row exists for it, whether or not the
 * template row itself still exists.
 */
export function seedDefaultTemplates(db: Db): void {
  seedWelcomeTemplate(db);
  for (const template of LIBRARY_TEMPLATES) {
    seedLibraryTemplate(db, template);
  }
}
