import { describe, it, expect } from 'vitest';
import {
  recipientSchema,
  parseRecipientsCsv,
  deriveNameFromEmail,
} from './schema';

describe('recipientSchema', () => {
  it('accepts a valid email and lowercases it', () => {
    // Arrange / Act
    const result = recipientSchema.safeParse({ email: 'Person@Example.COM' });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('person@example.com');
  });

  it('rejects an invalid email', () => {
    // Arrange / Act
    const result = recipientSchema.safeParse({ email: 'not-an-email' });

    // Assert
    expect(result.success).toBe(false);
  });

  it('treats an empty name as undefined', () => {
    // Arrange / Act
    const result = recipientSchema.safeParse({ email: 'a@x.io', name: '   ' });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeUndefined();
  });
});

describe('deriveNameFromEmail', () => {
  it('uses the local part of the address', () => {
    expect(deriveNameFromEmail('jane.doe@example.com')).toBe('jane.doe');
  });
});

describe('parseRecipientsCsv', () => {
  it('parses newline-separated emails', () => {
    // Arrange
    const input = 'a@x.io\nb@x.io\n';

    // Act
    const { entries, invalid, duplicates } = parseRecipientsCsv(input);

    // Assert
    expect(entries.map(e => e.email)).toEqual(['a@x.io', 'b@x.io']);
    expect(invalid).toEqual([]);
    expect(duplicates).toEqual([]);
  });

  it('parses comma-separated emails on a single line', () => {
    // Arrange / Act
    const { entries } = parseRecipientsCsv('a@x.io, b@x.io, c@x.io');

    // Assert
    expect(entries.map(e => e.email)).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
  });

  it('parses email,Name pairs per line', () => {
    // Arrange / Act
    const { entries } = parseRecipientsCsv('bob@x.io, Bob Smith');

    // Assert
    expect(entries).toEqual([{ email: 'bob@x.io', name: 'Bob Smith' }]);
  });

  it('derives a name from the email when none is provided', () => {
    // Arrange / Act
    const { entries } = parseRecipientsCsv('jane@x.io');

    // Assert
    expect(entries[0]).toEqual({ email: 'jane@x.io', name: 'jane' });
  });

  it('collects invalid tokens separately', () => {
    // Arrange / Act
    const { entries, invalid } = parseRecipientsCsv('good@x.io\nnope\nalso@x.io');

    // Assert
    expect(entries.map(e => e.email)).toEqual(['good@x.io', 'also@x.io']);
    expect(invalid).toEqual(['nope']);
  });

  it('dedupes case-insensitively and keeps the first occurrence', () => {
    // Arrange / Act
    const { entries, duplicates } = parseRecipientsCsv('Dup@x.io\ndup@x.io\nother@x.io');

    // Assert
    expect(entries.map(e => e.email)).toEqual(['dup@x.io', 'other@x.io']);
    expect(duplicates).toEqual(['dup@x.io']);
  });

  it('handles mixed newline and comma separators', () => {
    // Arrange / Act
    const { entries } = parseRecipientsCsv('a@x.io, b@x.io\nc@x.io');

    // Assert
    expect(entries.map(e => e.email)).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
  });

  it('parses mixed comma-separated entries with a name', () => {
    // Arrange / Act
    const { entries } = parseRecipientsCsv('a@x.com, b@x.com, Bob\nc@x.com, Carol');

    // Assert
    expect(entries).toEqual([
      { email: 'a@x.com', name: 'a' },
      { email: 'b@x.com', name: 'Bob' },
      { email: 'c@x.com', name: 'Carol' },
    ]);
  });
});
