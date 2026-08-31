import { describe, it, expect } from 'vitest';
import { digestIssueUrl } from './issue-url';

describe('digestIssueUrl', () => {
  it('returns null when the row is undefined', () => {
    expect(digestIssueUrl(undefined, 'https://app.example')).toBeNull();
  });

  it('returns null when webHtml is missing even if slug is present (e.g. skipped/failed digest)', () => {
    expect(digestIssueUrl({ slug: 'abc123', webHtml: null }, 'https://app.example')).toBeNull();
  });

  it('returns null when slug is missing', () => {
    expect(digestIssueUrl({ slug: null, webHtml: '<html></html>' }, 'https://app.example')).toBeNull();
  });

  it('returns the issue URL when both slug and webHtml are present', () => {
    expect(digestIssueUrl({ slug: 'abc123', webHtml: '<html></html>' }, 'https://app.example')).toBe(
      'https://app.example/issues/abc123',
    );
  });
});
