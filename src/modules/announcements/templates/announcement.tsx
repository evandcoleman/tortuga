import { Section } from '@react-email/components';
import * as React from 'react';
import { marked } from 'marked';

import { EmailShell } from '@/modules/newsletter/templates/shell';
import { resolveThemeWithOverrides } from '@/modules/newsletter/templates/themes';
import type { Appearance } from '@/modules/newsletter/appearance/schema';

export interface AnnouncementEmailProps {
  subject: string;
  body: string;
  unsubscribeUrl: string;
  appName: string;
  themeId?: string;
  appearance?: Appearance;
}

// One-off announcement email: the same themed shell as the weekly digest,
// wrapping trusted admin-authored markdown. No block toggles, no layout
// selection — just subject + rendered markdown body.
export function AnnouncementEmail({
  subject,
  body,
  unsubscribeUrl,
  appName,
  themeId,
  appearance,
}: AnnouncementEmailProps) {
  const theme = resolveThemeWithOverrides(themeId, appearance?.theme_overrides);
  const bodyHtml = marked.parse(body, { async: false }) as string;

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
