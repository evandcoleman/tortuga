import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import {
  listTemplates,
  getTemplateBySlug,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  UndeletableTemplateError,
  DuplicateSlugError,
} from './service';
import { seedWelcomeTemplate } from './seed';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

describe('templates service', () => {
  it('creates and fetches a template by slug', () => {
    const db = makeDb();
    const created = createTemplate(db, { slug: 'reminder', name: 'Reminder', subject: 'Hi', body: 'Body' });
    expect(created.slug).toBe('reminder');
    const fetched = getTemplateBySlug(db, 'reminder');
    expect(fetched?.name).toBe('Reminder');
  });

  it('returns null for an unknown slug', () => {
    const db = makeDb();
    expect(getTemplateBySlug(db, 'nope')).toBeNull();
  });

  it('rejects a duplicate slug', () => {
    const db = makeDb();
    createTemplate(db, { slug: 'dup', name: 'A', subject: 'S', body: 'B' });
    expect(() => createTemplate(db, { slug: 'dup', name: 'B', subject: 'S', body: 'B' })).toThrow(DuplicateSlugError);
  });

  it('lists all templates', () => {
    const db = makeDb();
    createTemplate(db, { slug: 'a', name: 'A', subject: 'S', body: 'B' });
    createTemplate(db, { slug: 'b', name: 'B', subject: 'S', body: 'B' });
    expect(listTemplates(db).map(t => t.slug).sort()).toEqual(['a', 'b']);
  });

  it('updates subject and body, bumping updatedAt', () => {
    const db = makeDb();
    const created = createTemplate(db, { slug: 'x', name: 'X', subject: 'Old', body: 'Old body' });
    const updated = updateTemplate(db, 'x', { subject: 'New', body: 'New body' });
    expect(updated?.subject).toBe('New');
    expect(updated?.body).toBe('New body');
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('returns null when updating an unknown slug', () => {
    const db = makeDb();
    expect(updateTemplate(db, 'nope', { subject: 'S' })).toBeNull();
  });

  it('deletes a non-seed template', () => {
    const db = makeDb();
    createTemplate(db, { slug: 'temp', name: 'Temp', subject: 'S', body: 'B' });
    expect(deleteTemplate(db, 'temp')).toBe(true);
    expect(getTemplateBySlug(db, 'temp')).toBeNull();
  });

  it('returns false when deleting an unknown slug', () => {
    const db = makeDb();
    expect(deleteTemplate(db, 'nope')).toBe(false);
  });

  it('refuses to delete the seeded welcome template', () => {
    const db = makeDb();
    seedWelcomeTemplate(db);
    expect(() => deleteTemplate(db, 'welcome')).toThrow(UndeletableTemplateError);
    expect(getTemplateBySlug(db, 'welcome')).not.toBeNull();
  });

  it('still allows editing the welcome template', () => {
    const db = makeDb();
    seedWelcomeTemplate(db);
    const updated = updateTemplate(db, 'welcome', { subject: 'Custom welcome subject' });
    expect(updated?.subject).toBe('Custom welcome subject');
  });
});
