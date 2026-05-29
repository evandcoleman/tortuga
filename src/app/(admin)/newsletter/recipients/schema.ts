import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .transform(v => v.toLowerCase());

export const recipientSchema = z.object({
  email: emailField,
  name: z
    .string()
    .trim()
    .max(200, 'Name is too long')
    .optional()
    .transform(v => (v && v.length > 0 ? v : undefined)),
});
export type RecipientInput = z.infer<typeof recipientSchema>;

export const removeSchema = z.object({ email: emailField });

/** A single parsed CSV entry: a valid email plus an optional display name. */
export interface ParsedCsvEntry {
  email: string;
  name: string;
}

export interface CsvParseResult {
  entries: ParsedCsvEntry[];
  invalid: string[];
  duplicates: string[];
}

const singleLineSchema = recipientSchema;

/**
 * Parse pasted text into recipient entries. Accepts newline- and/or
 * comma-separated lists. Each token may be a bare email (`a@x.io`) or an
 * `email,Name` pair on its own line. To disambiguate the comma used as a
 * field separator from the comma used as a record separator, splitting happens
 * line-first: each line is split on commas, the first comma-token that looks
 * like an email becomes the email and the remainder (if any) becomes the name.
 * Lines with no email token are collected as invalid. Duplicate emails (after
 * lower-casing) are reported and only the first occurrence is kept.
 */
export function parseRecipientsCsv(input: string): CsvParseResult {
  const entries: ParsedCsvEntry[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  const lines = input
    .split(/\r?\n/)
    .flatMap(line => splitLineIntoRecords(line))
    .map(record => record.trim())
    .filter(record => record.length > 0);

  for (const record of lines) {
    const parsed = parseRecord(record);
    if (!parsed) {
      invalid.push(record);
      continue;
    }
    if (seen.has(parsed.email)) {
      duplicates.push(parsed.email);
      continue;
    }
    seen.add(parsed.email);
    entries.push(parsed);
  }

  return { entries, invalid, duplicates };
}

/**
 * Split a single line into logical records. A line containing only
 * comma-separated emails (no name parts) is treated as multiple records, while
 * a line that resolves to one `email,Name` pair stays a single record. We
 * detect this by checking whether every comma-token is itself a valid email.
 */
function splitLineIntoRecords(line: string): string[] {
  const tokens = line.split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (tokens.length <= 1) return [line];
  const allEmails = tokens.every(t => singleLineSchema.shape.email.safeParse(t).success);
  return allEmails ? tokens : [line];
}

function parseRecord(record: string): ParsedCsvEntry | null {
  const parts = record.split(',').map(p => p.trim());
  const [emailPart, ...nameParts] = parts;
  const result = recipientSchema.safeParse({
    email: emailPart,
    name: nameParts.join(', ') || undefined,
  });
  if (!result.success) return null;
  return {
    email: result.data.email,
    name: result.data.name ?? deriveNameFromEmail(result.data.email),
  };
}

/** Fall back to the local part of the email as a display name. */
export function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.length > 0 ? local : email;
}
