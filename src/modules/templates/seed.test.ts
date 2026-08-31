import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { createDb, type Db } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { templates } from './schema';
import { seedWelcomeTemplate } from './seed';
import { WELCOME_TEMPLATE_SLUG } from './welcome-content';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

/**
 * Simulates the concurrent-boot race: another process's insert wins between
 * this call's existence check and its own insert. Forces `select` to report
 * "not found" while the real `insert` still runs against the underlying db
 * (which already has a conflicting row), so a naive select-then-insert would
 * hit the unique constraint on `slug`.
 */
function racingDb(db: Db): Db {
  return {
    ...db,
    select: () => ({ from: () => ({ where: () => ({ get: () => undefined }) }) }),
    insert: db.insert.bind(db),
  } as unknown as Db;
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

  it('does not throw when a concurrent boot already inserted the row between the check and the insert', () => {
    const db = makeDb();
    const now = new Date();
    db.insert(templates).values({
      id: createId(),
      slug: WELCOME_TEMPLATE_SLUG,
      name: 'Winner of the race',
      subject: 'Winner subject',
      body: 'Winner body',
      createdAt: now,
      updatedAt: now,
    }).run();

    expect(() => seedWelcomeTemplate(racingDb(db))).not.toThrow();

    const rows = db.select().from(templates).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('Winner subject');
  });
});
