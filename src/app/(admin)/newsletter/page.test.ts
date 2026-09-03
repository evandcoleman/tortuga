import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect }));

import NewsletterIndex from './page';

describe('/newsletter', () => {
  beforeEach(() => {
    redirect.mockReset();
  });

  it('redirects to /newsletter/preview', () => {
    NewsletterIndex();

    expect(redirect).toHaveBeenCalledWith('/newsletter/preview');
  });
});
