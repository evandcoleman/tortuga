import { render, toPlainText } from '@react-email/render';
import { createElement } from 'react';

import type { Appearance } from '@/modules/newsletter/appearance/schema';

import { substituteVariables, type TemplateVariables } from './substitute';
import { TemplateEmail } from './email';

export interface RenderTemplateInput {
  subject: string;
  /** Markdown with {{variables}}. */
  body: string;
}

export interface RenderTemplateOptions {
  vars: TemplateVariables;
  appName: string;
  themeId?: string;
  appearance?: Appearance;
  /** Omitted for transactional sends — no unsubscribe link. */
  unsubscribeUrl?: string;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Variable substitution happens before markdown rendering (per spec):
 * subject and body are both substituted first, then the body markdown is
 * rendered inside the shared React Email chrome, and a plain-text
 * alternative is derived from the resulting HTML.
 */
export async function renderTemplate(
  input: RenderTemplateInput,
  options: RenderTemplateOptions,
): Promise<RenderedTemplate> {
  const subject = substituteVariables(input.subject, options.vars);
  const body = substituteVariables(input.body, options.vars);

  const html = await render(
    createElement(TemplateEmail, {
      subject,
      body,
      appName: options.appName,
      themeId: options.themeId,
      appearance: options.appearance,
      unsubscribeUrl: options.unsubscribeUrl,
    }),
  );

  return { subject, html, text: toPlainText(html) };
}
