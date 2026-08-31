import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { templates } from './schema';
import { seedWelcomeTemplate } from './seed';
import { WELCOME_TEMPLATE_SLUG } from './welcome-content';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

describe('seedWelcomeTemplate', () => {
  it('inserts the welcome template on first run', () => {
    const db = makeDb();
    seedWelcomeTemplate(db);
    const rows = db.select().from(templates).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe(WELCOME_TEMPLATE_SLUG);
  });

  it('is idempotent — running it again does not duplicate or overwrite edits', () => {
    const db = makeDb();
    seedWelcomeTemplate(db);
    db.update(templates)
      .set({ subject: 'Admin-edited subject' })
      .where(eq(templates.slug, WELCOME_TEMPLATE_SLUG))
      .run();

    seedWelcomeTemplate(db);

    const after = db.select().from(templates).all();
    expect(after).toHaveLength(1);
    expect(after[0].subject).toBe('Admin-edited subject');
  });
});
