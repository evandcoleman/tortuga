import {
  Column,
  Heading,
  Hr,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../types';
import { resolveThemeWithOverrides } from './themes';
import type { ThemePalette } from './themes';
import { resolveLayout } from './layouts';
import { buildLibrarySections, resolveBlocks, resolveItemDisplay } from '../appearance/resolve';
import type { Appearance } from '../appearance/schema';
import type { BlockId } from '../appearance/schema';
import { EmailShell } from './shell';

export interface DigestLink {
  url: string;
  label: string;
}

/** Per-section item caps applied at render time; unset means uncapped (used by the web variant). */
export interface DigestLimits {
  perLibrarySection?: number;
  leavingSoon?: number;
}

export interface DigestEmailProps {
  items: EnrichedItem[];
  /** Omitted for the web variant, which has no per-recipient unsubscribe link. */
  unsubscribeUrl?: string;
  /** Omitted for the web variant. Links to the recipient preferences page. */
  preferencesUrl?: string;
  appName: string;
  windowStart: Date;
  windowEnd: Date;
  intro?: string;
  disclaimer?: boolean;
  themeId?: string;
  layoutId?: string;
  requestLink?: DigestLink;
  personalLink?: DigestLink;
  freeformHtml?: string;
  appearance?: Appearance;
  leavingItems?: EnrichedItem[];
  leavingHeading?: string;
  /** IANA timezone used to format the "Leaves <date>" label on leaving items. */
  timezone?: string;
  /** Per-section item caps; unset (the web variant) shows every item. */
  limits?: DigestLimits;
  /** Absolute URL to the hosted web version. Enables the "View this issue online" link and "View all" section links. */
  issueUrl?: string;
}

/** Stable, non-configurable id for a section's `#anchor` — independent of user-editable titles/headings. */
export function sectionAnchor(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export const LEAVING_SOON_ANCHOR = 'leaving-soon';

/** Link shown under a truncated section, pointing at that section's anchor on the hosted web version. */
function ViewAllLink({ href, total, palette }: { href: string; total: number; palette: ThemePalette }) {
  return (
    <Text style={{ margin: '10px 0 0', fontSize: 12 }}>
      <Link href={href} style={{ color: palette.accent, fontWeight: 600, textDecoration: 'none' }}>
        View all {total} →
      </Link>
    </Text>
  );
}

export function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', opts).format(d);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${fmt(start, { month: 'long', day: 'numeric' })}–${fmt(end, { day: 'numeric' })}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return `${fmt(start, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function DigestEmail({
  items,
  unsubscribeUrl,
  preferencesUrl,
  appName,
  windowStart,
  windowEnd,
  intro,
  disclaimer,
  themeId,
  layoutId,
  requestLink,
  personalLink,
  freeformHtml,
  appearance,
  leavingItems,
  leavingHeading,
  timezone,
  limits,
  issueUrl,
}: DigestEmailProps) {
  const theme = resolveThemeWithOverrides(themeId, appearance?.theme_overrides);
  const itemDisplay = resolveItemDisplay(appearance?.item_display);
  const header = appearance?.header;
  const footer = appearance?.footer;
  // `limits` is only ever supplied for the email variant; its absence (the web/hosted
  // variant) means rule-based per-library caps must not truncate anything either.
  const isEmailVariant = limits != null;
  const sections = buildLibrarySections(items, appearance?.libraries, { applyRuleCaps: isEmailVariant });
  const { palette, fonts, layout } = theme;

  const dateRange = formatDateRange(windowStart, windowEnd);
  const itemNoun = items.length === 1 ? 'addition' : 'additions';

  const showDateRange = header?.show_date_range !== false;
  const showCount = header?.show_count !== false;
  const headerMetaParts: string[] = [];
  if (showDateRange) headerMetaParts.push(dateRange);
  if (showCount) headerMetaParts.push(`${items.length} ${itemNoun}`);

  const headerNode = (
    <Section>
      <Text
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: layout.eyebrowLetterSpacing,
          textTransform: 'uppercase',
          color: palette.accent,
          fontWeight: 600,
        }}
      >
        {header?.eyebrow ?? `${appName} · Weekly`}
      </Text>
      <Heading
        as="h1"
        style={{
          margin: '10px 0 0',
          fontFamily: fonts.heading,
          fontSize: 36,
          lineHeight: 1.1,
          letterSpacing: layout.headingLetterSpacing,
          color: palette.ink,
          fontWeight: layout.headingWeight,
        }}
      >
        {header?.title ?? `New on ${appName}`}
      </Heading>
      {headerMetaParts.length > 0 ? (
        <Text
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: palette.muted,
          }}
        >
          {headerMetaParts.join(' · ')}
        </Text>
      ) : null}
    </Section>
  );

  const viewOnlineNode = issueUrl ? (
    <Text
      style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Link href={issueUrl} style={{ color: palette.accent, textDecoration: 'underline' }}>
        View this issue online →
      </Link>
    </Text>
  ) : null;

  const introNode = intro || viewOnlineNode ? (
    <Section style={{ marginTop: 20 }}>
      {viewOnlineNode}
      {intro ? (
        <Text
          style={{
            margin: viewOnlineNode ? '10px 0 0' : 0,
            fontFamily: fonts.heading,
            fontSize: 17,
            lineHeight: 1.55,
            color: palette.ink,
            fontStyle: layout.introItalic ? 'italic' : 'normal',
          }}
        >
          {intro}
        </Text>
      ) : null}
      {intro && disclaimer ? (
        <Text
          style={{
            margin: '8px 0 0',
            fontFamily: fonts.body,
            fontSize: 12,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: palette.muted,
          }}
        >
          Generated by AI
        </Text>
      ) : null}
    </Section>
  ) : null;

  const librariesNode =
    sections.length > 0 ? (
      <>
        <Hr
          style={{
            borderColor: palette.rule,
            borderStyle: 'solid',
            borderWidth: `0 0 ${layout.ruleWidth}px`,
            margin: '28px 0 0',
          }}
        />

        {sections.map(section => {
          const SectionLayout = resolveLayout(section.layoutId ?? layoutId);
          const anchor = sectionAnchor(section.name);
          const total = section.totalCount;
          const limit = limits?.perLibrarySection;
          const displayItems = limit != null ? section.items.slice(0, limit) : section.items;
          const truncated = displayItems.length < total;
          return (
            <Section key={section.name} id={anchor} style={{ marginTop: 32 }}>
              <Row>
                <Column>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: 10,
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                      color: palette.muted,
                      fontWeight: 600,
                    }}
                  >
                    {section.title}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ margin: 0, fontSize: 11, color: palette.muted }}>
                    {total} {total === 1 ? 'title' : 'titles'}
                  </Text>
                </Column>
              </Row>
              <Hr
                style={{
                  borderColor: palette.hairline,
                  borderStyle: 'solid',
                  borderWidth: '0 0 1px',
                  margin: '8px 0 0',
                }}
              />

              <SectionLayout.Items items={displayItems} theme={theme} itemDisplay={itemDisplay} timezone={timezone} />
              {truncated && issueUrl ? (
                <ViewAllLink href={`${issueUrl}#${anchor}`} total={total} palette={palette} />
              ) : null}
            </Section>
          );
        })}
      </>
    ) : null;

  const leavingNode =
    leavingItems && leavingItems.length > 0 ? (
      (() => {
        const SectionLayout = resolveLayout(layoutId);
        const total = leavingItems.length;
        const limit = limits?.leavingSoon;
        const truncated = limit != null && total > limit;
        const displayItems = truncated ? leavingItems.slice(0, limit) : leavingItems;
        return (
          <>
            <Hr
              style={{
                borderColor: palette.rule,
                borderStyle: 'solid',
                borderWidth: `0 0 ${layout.ruleWidth}px`,
                margin: '28px 0 0',
              }}
            />
            <Section id={LEAVING_SOON_ANCHOR} style={{ marginTop: 32 }}>
              <Row>
                <Column>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: 10,
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                      color: palette.muted,
                      fontWeight: 600,
                    }}
                  >
                    {leavingHeading ?? 'Leaving soon'}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ margin: 0, fontSize: 11, color: palette.muted }}>
                    {total} {total === 1 ? 'title' : 'titles'}
                  </Text>
                </Column>
              </Row>
              <Hr
                style={{
                  borderColor: palette.hairline,
                  borderStyle: 'solid',
                  borderWidth: '0 0 1px',
                  margin: '8px 0 0',
                }}
              />
              <SectionLayout.Items items={displayItems} theme={theme} itemDisplay={itemDisplay} timezone={timezone} />
              {truncated && issueUrl ? (
                <ViewAllLink href={`${issueUrl}#${LEAVING_SOON_ANCHOR}`} total={total} palette={palette} />
              ) : null}
            </Section>
          </>
        );
      })()
    ) : null;

  const freeformNode = freeformHtml ? (
    <Section
      style={{
        marginTop: 40,
        background: palette.cardBg,
        border: `${layout.cardBorderWidth}px solid ${palette.hairline}`,
        borderRadius: layout.radius,
        boxShadow: layout.cardShadow,
        padding: 16,
      }}
    >
      <Row>
        <Column>
          <div
            style={{ fontSize: 14, lineHeight: 1.55, color: palette.ink }}
            dangerouslySetInnerHTML={{ __html: freeformHtml }}
          />
        </Column>
      </Row>
    </Section>
  ) : null;

  const actionsNode =
    requestLink || personalLink ? (
      <Section style={{ marginTop: 32, textAlign: 'center' }}>
        {requestLink ? (
          <Link
            href={requestLink.url}
            style={{
              display: 'inline-block',
              margin: '0 8px',
              padding: '10px 18px',
              borderRadius: layout.radius === 0 ? 0 : 999,
              background: palette.accent,
              color: palette.onAccent,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: 0.2,
            }}
          >
            {requestLink.label}
          </Link>
        ) : null}
        {personalLink ? (
          <Link
            href={personalLink.url}
            style={{
              display: 'inline-block',
              margin: '0 8px',
              fontSize: 13,
              fontWeight: 600,
              color: palette.accent,
              textDecoration: 'none',
            }}
          >
            {personalLink.label}
          </Link>
        ) : null}
      </Section>
    ) : null;

  const footerNode = (
    <>
      <Hr
        style={{
          borderColor: palette.rule,
          borderStyle: 'solid',
          borderWidth: `0 0 ${layout.ruleWidth}px`,
          margin: '48px 0 20px',
        }}
      />
      {footer?.show_app_label !== false ? (
        <Text
          style={{
            margin: 0,
            fontSize: 11,
            color: palette.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {appName}
        </Text>
      ) : null}
      {footer?.text ? (
        <Text
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: palette.muted,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {footer.text}
        </Text>
      ) : null}
    </>
  );

  const blockNodes: Record<BlockId, React.ReactNode> = {
    header: headerNode,
    intro: introNode,
    libraries: librariesNode,
    leaving: leavingNode,
    freeform: freeformNode,
    actions: actionsNode,
    footer: footerNode,
  };
  const ordered = resolveBlocks(appearance?.blocks);

  return (
    <EmailShell
      theme={theme}
      appName={appName}
      unsubscribeUrl={unsubscribeUrl}
      preferencesUrl={preferencesUrl}
      previewText={`${items.length} new on ${appName} · ${dateRange}`}
    >
      {ordered
        .filter(b => b.enabled)
        .map(b => (
          <React.Fragment key={b.id}>{blockNodes[b.id]}</React.Fragment>
        ))}
    </EmailShell>
  );
}
