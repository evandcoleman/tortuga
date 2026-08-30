import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

const POSTER_W = 132;
const POSTER_H = 198;

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
};

export function LedgerItems({ items, theme, itemDisplay, timezone }: LayoutItemsProps) {
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  return (
    <>
      {items.map((item, index) => (
        <LedgerEntry
          key={item.guid}
          item={item}
          theme={theme}
          display={d}
          posterLeft={index % 2 === 0}
          withRule={index > 0}
          timezone={timezone}
        />
      ))}
    </>
  );
}

interface LedgerEntryProps {
  item: EnrichedItem;
  theme: Theme;
  display: ResolvedItemDisplay;
  posterLeft: boolean;
  withRule: boolean;
  timezone?: string;
}

function LedgerEntry({ item, theme, display, posterLeft, withRule, timezone }: LedgerEntryProps) {
  const { palette, fonts, layout } = theme;
  const kicker = itemKicker(item, timezone);
  const overview = truncate(item.overview, display.overviewMaxChars ?? 260);
  const showsRating = display.showRating && item.rating > 0;
  const title = displayTitle(item);
  const posterRadius = Math.min(4, layout.radius);
  const scale = posterScaleFactor(display.posterScale);
  const posterW = Math.round(POSTER_W * scale);
  const posterH = Math.round(POSTER_H * scale);
  const colW = Math.round((POSTER_W + 24) * scale);

  const posterColumn = display.showPoster ? (
    <Column
      style={{
        verticalAlign: 'top',
        width: colW,
        paddingRight: posterLeft ? 24 : 0,
        paddingLeft: posterLeft ? 0 : 24,
      }}
    >
      {item.posterUrl ? (
        <Img
          src={item.posterUrl}
          alt=""
          width={posterW}
          height={posterH}
          style={{
            display: 'block',
            width: posterW,
            height: posterH,
            borderRadius: posterRadius,
            border: `1px solid ${palette.hairline}`,
            background: palette.chipBg,
          }}
        />
      ) : (
        <div
          style={{
            width: posterW,
            height: posterH,
            borderRadius: posterRadius,
            background: palette.chipBg,
            border: `1px dashed ${palette.rule}`,
          }}
        />
      )}
    </Column>
  ) : null;

  const textColumn = (
    <Column style={{ verticalAlign: 'top' }}>
      {kicker ? (
        <Text
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: layout.eyebrowLetterSpacing,
            textTransform: 'uppercase',
            color: palette.chipFg,
            fontFamily: fonts.body,
            fontWeight: 600,
          }}
        >
          {kicker}
        </Text>
      ) : null}

      <Heading
        as="h3"
        style={{
          margin: '6px 0 0',
          fontFamily: fonts.heading,
          fontSize: 24,
          lineHeight: 1.18,
          letterSpacing: layout.headingLetterSpacing,
          color: palette.ink,
          fontWeight: layout.headingWeight,
        }}
      >
        {title}
      </Heading>

      {showsRating ? (
        <Text style={{ margin: '8px 0 0', fontSize: 12, color: palette.muted }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: layout.radius === 0 ? 0 : 999,
              background: palette.chipBg,
              color: palette.chipFg,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            ★ {item.rating.toFixed(1)}
          </span>
        </Text>
      ) : null}

      {display.showOverview && overview ? (
        <Text
          style={{
            margin: '12px 0 0',
            fontSize: 14,
            lineHeight: 1.6,
            color: palette.ink,
            fontFamily: fonts.body,
          }}
        >
          {overview}
        </Text>
      ) : null}

      {item.plexUrl ? (
        <Text style={{ margin: '14px 0 0', fontSize: 13 }}>
          <Link
            href={item.plexUrl}
            style={{
              color: palette.accent,
              textDecoration: 'none',
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            Open in Plex →
          </Link>
        </Text>
      ) : null}
    </Column>
  );

  return (
    <Section
      style={{
        borderTop: withRule ? `${layout.ruleWidth}px solid ${palette.hairline}` : undefined,
        paddingTop: withRule ? 28 : 0,
        marginTop: withRule ? 28 : 20,
      }}
    >
      {display.showPoster ? (
        <Row>
          {posterLeft ? posterColumn : textColumn}
          {posterLeft ? textColumn : posterColumn}
        </Row>
      ) : (
        <Row>{textColumn}</Row>
      )}
    </Section>
  );
}
