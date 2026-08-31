import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';

import { templates } from './schema';
import { WELCOME_TEMPLATE_SLUG } from './welcome-content';

export type Template = typeof templates.$inferSelect;

export class DuplicateSlugError extends Error {
  constructor(slug: string) {
    super(`A template with slug "${slug}" already exists`);
    this.name = 'DuplicateSlugError';
  }
}

export class UndeletableTemplateError extends Error {
  constructor(slug: string) {
    super(`The "${slug}" template is a system default and cannot be deleted`);
    this.name = 'UndeletableTemplateError';
  }
}

export interface CreateTemplateInput {
  slug: string;
  name: string;
  subject: string;
  body: string;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
}

export function listTemplates(db: Db): Template[] {
  return db.select().from(templates).all();
}

export function getTemplateBySlug(db: Db, slug: string): Template | null {
  const row = db.select().from(templates).where(eq(templates.slug, slug)).get();
  return row ?? null;
}

export function createTemplate(db: Db, input: CreateTemplateInput): Template {
  if (getTemplateBySlug(db, input.slug)) {
    throw new DuplicateSlugError(input.slug);
  }
  const now = new Date();
  const row: Template = {
    id: createId(),
    slug: input.slug,
    name: input.name,
    subject: input.subject,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(templates).values(row).run();
  return row;
}

/** Returns null when the slug doesn't exist. */
export function updateTemplate(db: Db, slug: string, input: UpdateTemplateInput): Template | null {
  const existing = getTemplateBySlug(db, slug);
  if (!existing) return null;

  db.update(templates)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      updatedAt: new Date(),
    })
    .where(eq(templates.slug, slug))
    .run();

  return getTemplateBySlug(db, slug);
}

/** Returns false when the slug doesn't exist. Throws for the seeded welcome template. */
export function deleteTemplate(db: Db, slug: string): boolean {
  if (slug === WELCOME_TEMPLATE_SLUG) {
    throw new UndeletableTemplateError(slug);
  }
  const result = db.delete(templates).where(eq(templates.slug, slug)).run();
  return result.changes > 0;
}
