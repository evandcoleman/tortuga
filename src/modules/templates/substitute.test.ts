import { describe, it, expect } from 'vitest';
import { substituteVariables, substituteTokens, type TemplateVariables } from './substitute';

describe('substituteTokens', () => {
  it('replaces arbitrary named tokens', () => {
    const out = substituteTokens('Go to {{plex_url}} on {{server_name}}.', {
      plex_url: 'https://app.plex.tv',
      server_name: 'Olympus',
    });
    expect(out).toBe('Go to https://app.plex.tv on Olympus.');
  });

  it('leaves a token untouched when its value is undefined or null', () => {
    const out = substituteTokens('Status: {{status_url}}', { status_url: undefined });
    expect(out).toBe('Status: {{status_url}}');
  });

  it('leaves unknown tokens untouched', () => {
    const out = substituteTokens('{{unknown}}', {});
    expect(out).toBe('{{unknown}}');
  });
});

describe('substituteVariables', () => {
  const vars: TemplateVariables = { name: 'Ada', email: 'ada@x.io', serverName: 'Olympus' };

  it('replaces {{name}}, {{email}}, {{server_name}}', () => {
    const out = substituteVariables('Hi {{name}}, welcome to {{server_name}}. ({{email}})', vars);
    expect(out).toBe('Hi Ada, welcome to Olympus. (ada@x.io)');
  });

  it('tolerates internal whitespace inside the braces', () => {
    const out = substituteVariables('Hi {{ name }}!', vars);
    expect(out).toBe('Hi Ada!');
  });

  it('renders unknown variables literally, without crashing', () => {
    const out = substituteVariables('Hi {{name}}, your {{unknown_var}} is ready.', vars);
    expect(out).toBe('Hi Ada, your {{unknown_var}} is ready.');
  });

  it('falls back {{name}} to the email local part when no name is known', () => {
    const out = substituteVariables('Hi {{name}}!', { name: null, email: 'grover@x.io', serverName: 'Olympus' });
    expect(out).toBe('Hi grover!');
  });

  it('falls back {{name}} to the email local part when name is an empty string', () => {
    const out = substituteVariables('Hi {{name}}!', { name: '  ', email: 'grover@x.io', serverName: 'Olympus' });
    expect(out).toBe('Hi grover!');
  });

  it('renders {{name}} literally when there is no name and no email to fall back to', () => {
    const out = substituteVariables('Hi {{name}}!', { name: null, email: '', serverName: 'Olympus' });
    expect(out).toBe('Hi {{name}}!');
  });

  it('substitutes repeated occurrences of the same variable', () => {
    const out = substituteVariables('{{name}} {{name}}', vars);
    expect(out).toBe('Ada Ada');
  });

  it('applies the same substitution rules to subjects', () => {
    const out = substituteVariables('Welcome, {{name}}!', vars);
    expect(out).toBe('Welcome, Ada!');
  });

  it('leaves text with no variables untouched', () => {
    const out = substituteVariables('Plain text, no braces.', vars);
    expect(out).toBe('Plain text, no braces.');
  });
});
