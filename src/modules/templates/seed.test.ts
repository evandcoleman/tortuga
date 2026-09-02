import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { createDb, type Db } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { templates, templateSeeds } from './schema';
import { seedWelcomeTemplate, seedDefaultTemplates, DEFAULT_TEMPLATES } from './seed';
import { WELCOME_TEMPLATE_SLUG } from './welcome-content';
import { LIBRARY_TEMPLATES } from './library-content';
import { deleteTemplate } from './service';

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
    const rows = db.select().from(templates).where(eq(templates.slug, WELCOME_TEMPLATE_SLUG)).all();
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

    const after = db.select().from(templates).where(eq(templates.slug, WELCOME_TEMPLATE_SLUG)).all();
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

    const rows = db.select().from(templates).where(eq(templates.slug, WELCOME_TEMPLATE_SLUG)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('Winner subject');
  });
});

describe('seedDefaultTemplates', () => {
  it('seeds welcome plus all library templates on an empty db', () => {
    const db = makeDb();
    seedDefaultTemplates(db);

    const rows = db.select().from(templates).all();
    expect(rows).toHaveLength(DEFAULT_TEMPLATES.length);
    const slugs = rows.map((row) => row.slug).sort();
    expect(slugs).toEqual(
      [WELCOME_TEMPLATE_SLUG, ...LIBRARY_TEMPLATES.map((t) => t.slug)].sort(),
    );

    // Every library slug (not welcome) gets a seed-tracking row.
    const seedRows = db.select().from(templateSeeds).all();
    expect(seedRows.map((r) => r.slug).sort()).toEqual(
      LIBRARY_TEMPLATES.map((t) => t.slug).sort(),
    );
  });

  it('running it again inserts nothing new', () => {
    const db = makeDb();
    seedDefaultTemplates(db);
    seedDefaultTemplates(db);

    const rows = db.select().from(templates).all();
    expect(rows).toHaveLength(DEFAULT_TEMPLATES.length);
    const seedRows = db.select().from(templateSeeds).all();
    expect(seedRows).toHaveLength(LIBRARY_TEMPLATES.length);
  });

  it('deleting a library template then re-seeding does not restore it', () => {
    const db = makeDb();
    seedDefaultTemplates(db);

    const deleted = deleteTemplate(db, 'password-help');
    expect(deleted).toBe(true);

    seedDefaultTemplates(db);

    const row = db.select().from(templates).where(eq(templates.slug, 'password-help')).get();
    expect(row).toBeUndefined();

    // Other library templates and welcome are unaffected.
    const rows = db.select().from(templates).all();
    expect(rows).toHaveLength(DEFAULT_TEMPLATES.length - 1);
  });

  it('leaves an edited welcome row untouched', () => {
    const db = makeDb();
    seedDefaultTemplates(db);
    db.update(templates)
      .set({ subject: 'Admin-edited subject' })
      .where(eq(templates.slug, WELCOME_TEMPLATE_SLUG))
      .run();

    seedDefaultTemplates(db);

    const row = db.select().from(templates).where(eq(templates.slug, WELCOME_TEMPLATE_SLUG)).get();
    expect(row?.subject).toBe('Admin-edited subject');
  });

  it('does not overwrite a library-slug row that pre-existed without a seed row, but tracks it going forward', () => {
    const db = makeDb();
    const now = new Date();
    db.insert(templates).values({
      id: createId(),
      slug: 'password-help',
      name: 'Custom name before seeding ever ran',
      subject: 'Custom subject',
      body: 'Custom body',
      createdAt: now,
      updatedAt: now,
    }).run();

    seedDefaultTemplates(db);

    const row = db.select().from(templates).where(eq(templates.slug, 'password-help')).get();
    expect(row?.subject).toBe('Custom subject');

    const seedRow = db.select().from(templateSeeds).where(eq(templateSeeds.slug, 'password-help')).get();
    expect(seedRow).toBeDefined();
  });
});
