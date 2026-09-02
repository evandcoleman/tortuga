import { Body, Container, Head, Html, Link, Preview, Text } from '@react-email/components';
import * as React from 'react';
import type { Theme } from './themes';

export interface EmailShellProps {
  theme: Theme;
  appName: string;
  /** Omitted for the web variant, which has no per-recipient unsubscribe link. */
  unsubscribeUrl?: string;
  /** Omitted for the web variant. Links to the recipient preferences page. */
  preferencesUrl?: string;
  previewText?: string;
  children: React.ReactNode;
}

/**
 * Outer wrapper shared by every outbound email: theme colours/fonts, the
 * Html/Head/Body/Container scaffold, and the mandatory unsubscribe line
 * (never removable, regardless of appearance settings).
 */
export function EmailShell({ theme, appName, unsubscribeUrl, preferencesUrl, previewText, children }: EmailShellProps) {
  const { palette, fonts } = theme;

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content={theme.colorScheme} />
        <meta name="supported-color-schemes" content={theme.colorScheme} />
      </Head>
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: palette.paper,
          color: palette.ink,
          fontFamily: fonts.body,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '40px 28px 56px',
            background: palette.paper,
          }}
        >
          {children}

          {unsubscribeUrl ? (
            <Text
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: palette.muted,
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              You&apos;re receiving this because you have access to {appName}.
              <br />
              <Link
                href={unsubscribeUrl}
                style={{ color: palette.muted, textDecoration: 'underline' }}
              >
                Unsubscribe
              </Link>
              {preferencesUrl ? (
                <>
                  {' · '}
                  <Link
                    href={preferencesUrl}
                    style={{ color: palette.muted, textDecoration: 'underline' }}
                  >
                    Manage preferences
                  </Link>
                </>
              ) : null}
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
