import { z } from 'zod';

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be 100 characters or fewer')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens');

export const nameSchema = z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or fewer');
export const subjectSchema = z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or fewer');
export const bodySchema = z.string().trim().min(1, 'Body is required').max(20000, 'Body must be 20,000 characters or fewer');

export const createTemplateSchema = z.object({
  slug: slugSchema,
  name: nameSchema,
  subject: subjectSchema,
  body: bodySchema,
});

export const updateTemplateSchema = z
  .object({
    name: nameSchema.optional(),
    subject: subjectSchema.optional(),
    body: bodySchema.optional(),
  })
  .refine(v => v.name !== undefined || v.subject !== undefined || v.body !== undefined, {
    message: 'At least one field must be provided',
  });

export const previewTemplateSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().email().optional(),
});

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
