import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { createElement } from 'react';
import { AnnouncementEmail } from './announcement';

describe('AnnouncementEmail', () => {
  const baseProps = {
    subject: 'Server maintenance tonight',
    body: '## Heads up\n\nWe will be down briefly. See [status page](https://status.example.com).',
    unsubscribeUrl: 'https://x/u?token=abc',
    appName: 'Tortuga',
  };

  it('renders markdown (heading + link) inside the shell with the unsubscribe URL', async () => {
    const html = await render(createElement(AnnouncementEmail, baseProps));
    expect(html).toContain('Heads up');
    expect(html).toContain('href="https://status.example.com"');
    expect(html).toContain('status page');
    expect(html).toContain('https://x/u?token=abc');
    expect(html).toContain('Unsubscribe');
  });

  it('renders a "Manage preferences" link next to Unsubscribe when preferencesUrl is set', async () => {
    const html = await render(
      createElement(AnnouncementEmail, { ...baseProps, preferencesUrl: 'https://x/preferences?token=abc' }),
    );
    expect(html).toContain('Manage preferences');
    expect(html).toContain('https://x/preferences?token=abc');
  });

  it('applies the requested theme palette', async () => {
    const html = await render(createElement(AnnouncementEmail, { ...baseProps, themeId: 'dark-luxury' }));
    expect(html).toContain('#0e0d0b'); // dark-luxury paper
  });
});
