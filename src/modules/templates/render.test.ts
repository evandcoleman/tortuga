import { describe, it, expect } from 'vitest';
import { renderTemplate } from './render';

describe('renderTemplate', () => {
  const vars = { name: 'Ada', email: 'ada@x.io', serverName: 'Olympus' };

  it('substitutes variables in subject and body before markdown rendering', async () => {
    const result = await renderTemplate(
      { subject: 'Welcome, {{name}}!', body: '## Hi {{name}}\n\nJoin **{{server_name}}**.' },
      { vars, appName: 'Tortuga' },
    );
    expect(result.subject).toBe('Welcome, Ada!');
    expect(result.html).toContain('Hi Ada');
    expect(result.html).toContain('<strong>Olympus</strong>');
  });

  it('produces a plain-text alternative alongside the html', async () => {
    const result = await renderTemplate(
      { subject: 'Hi {{name}}', body: 'Body for {{name}}.' },
      { vars, appName: 'Tortuga' },
    );
    expect(result.text).toContain('Body for Ada.');
    expect(result.text).not.toContain('<');
  });

  it('renders unknown variables literally without crashing', async () => {
    const result = await renderTemplate(
      { subject: 'Hi {{name}}', body: 'Your {{mystery}} awaits.' },
      { vars, appName: 'Tortuga' },
    );
    expect(result.html).toContain('{{mystery}}');
  });

  it('applies the requested theme palette', async () => {
    const result = await renderTemplate(
      { subject: 'Hi', body: 'Body' },
      { vars, appName: 'Tortuga', themeId: 'dark-luxury' },
    );
    expect(result.html).toContain('#0e0d0b');
  });

  it('omits the unsubscribe link when no unsubscribeUrl is given (transactional)', async () => {
    const result = await renderTemplate(
      { subject: 'Hi', body: 'Body' },
      { vars, appName: 'Tortuga' },
    );
    expect(result.html).not.toContain('Unsubscribe');
  });

  it('includes the unsubscribe link when an unsubscribeUrl is given', async () => {
    const result = await renderTemplate(
      { subject: 'Hi', body: 'Body' },
      { vars, appName: 'Tortuga', unsubscribeUrl: 'https://x/u?token=abc' },
    );
    expect(result.html).toContain('https://x/u?token=abc');
  });
});
