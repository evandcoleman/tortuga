import { Section } from '@react-email/components';
import * as React from 'react';

import { EmailShell } from '@/modules/newsletter/templates/shell';
import { resolveThemeWithOverrides } from '@/modules/newsletter/templates/themes';
import type { Appearance } from '@/modules/newsletter/appearance/schema';
import { renderMarkdown } from './markdown';

export interface TemplateEmailProps {
  subject: string;
  /** Already variable-substituted markdown. */
  body: string;
  appName: string;
  themeId?: string;
  appearance?: Appearance;
  /** Omitted for transactional sends (e.g. the welcome email) — no unsubscribe link. */
  unsubscribeUrl?: string;
}

// Reuses the exact same themed shell as announcements — markdown body,
// trusted admin-authored content, no block toggles or layout selection.
export function TemplateEmail({
  subject,
  body,
  appName,
  themeId,
  appearance,
  unsubscribeUrl,
}: TemplateEmailProps) {
  const theme = resolveThemeWithOverrides(themeId, appearance?.theme_overrides);
  const bodyHtml = renderMarkdown(body);

  return (
    <EmailShell theme={theme} appName={appName} unsubscribeUrl={unsubscribeUrl} previewText={subject}>
      <Section>
        <div
          style={{ fontSize: 15, lineHeight: 1.6, color: theme.palette.ink, fontFamily: theme.fonts.body }}
          // Markdown is trusted admin input; no sanitiser beyond what `marked` applies.
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </Section>
    </EmailShell>
  );
}
