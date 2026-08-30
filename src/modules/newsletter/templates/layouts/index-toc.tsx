import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: false, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'sm',
};

const NUMBER_COL_W = 48;

// Zero-pad an index to at least the width implied by the total count, so the
// number rail stays aligned: 9 items -> "01", 120 items -> "001".
function padIndex(n: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return String(n).padStart(width, '0');
}

export function IndexTocItems({ items, theme, itemDisplay, timezone }: LayoutItemsProps) {
  const { palette } = theme;
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  if (items.length === 0) return null;
  return (
    <Section style={{ marginTop: 12, borderTop: `${theme.layout.ruleWidth}px solid ${palette.rule}` }}>
      {items.map((item, i) => (
        <IndexEntry
          key={item.guid}
          item={item}
          index={padIndex(i + 1, items.length)}
          theme={theme}
          display={d}
          timezone={timezone}
        />
      ))}
    </Section>
  );
}

function IndexEntry({
  item,
  index,
  theme,
  display,
  timezone,
}: {
  item: EnrichedItem;
  index: string;
  theme: Theme;
  display: ResolvedItemDisplay;
  timezone?: string;
}) {
  const { palette, fonts, layout } = theme;
  const kicker = itemKicker(item, timezone);
  const overview = truncate(item.overview, display.overviewMaxChars ?? 160);
  const showsRating = display.showRating && item.rating > 0;
  const title = displayTitle(item);
  const posterRadius = Math.min(4, layout.radius);
  const scale = posterScaleFactor(display.posterScale);
  const thumbW = Math.round(44 * scale);
  const thumbH = Math.round(66 * scale);
  const thumbColW = Math.round(thumbW + 16);

  return (
    <Row style={{ borderBottom: `${layout.ruleWidth}px solid ${palette.hairline}` }}>
      <Column
        style={{
          verticalAlign: 'top',
          width: NUMBER_COL_W,
          paddingRight: 12,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <Text
          style={{
            margin: 0,
            fontFamily: fonts.heading,
            fontSize: 28,
            lineHeight: 1,
            fontWeight: layout.headingWeight,
            letterSpacing: layout.headingLetterSpacing,
            color: palette.chipFg,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {index}
        </Text>
      </Column>

      {display.showPoster ? (
        <Column
          style={{
            verticalAlign: 'top',
            width: thumbColW,
            paddingRight: 16,
            paddingTop: 16,
            paddingBottom: 16,
          }}
        >
          {item.posterUrl ? (
            <Img
              src={item.posterUrl}
              alt=""
              width={thumbW}
              height={thumbH}
              style={{
                display: 'block',
                width: thumbW,
                height: thumbH,
                borderRadius: posterRadius,
                border: `1px solid ${palette.hairline}`,
                background: palette.chipBg,
              }}
            />
          ) : (
            <div
              style={{
                width: thumbW,
                height: thumbH,
                borderRadius: posterRadius,
                background: palette.chipBg,
                border: `1px dashed ${palette.rule}`,
              }}
            />
          )}
        </Column>
      ) : null}

      <Column style={{ verticalAlign: 'top', paddingTop: 16, paddingBottom: 16 }}>
        <Heading
          as="h3"
          style={{
            margin: 0,
            fontFamily: fonts.heading,
            fontSize: 18,
            lineHeight: 1.25,
            letterSpacing: layout.headingLetterSpacing,
            color: palette.ink,
            fontWeight: layout.headingWeight,
          }}
        >
          {item.plexUrl ? (
            <Link href={item.plexUrl} style={{ color: palette.ink, textDecoration: 'none' }}>
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>

        {kicker ? (
          <Text
            style={{
              margin: '4px 0 0',
              fontFamily: fonts.body,
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: palette.muted,
              fontWeight: 600,
            }}
          >
            {kicker}
          </Text>
        ) : null}

        {display.showOverview && overview ? (
          <Text
            style={{
              margin: '8px 0 0',
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 1.5,
              color: palette.muted,
            }}
          >
            {overview}
          </Text>
        ) : null}
      </Column>

      {showsRating ? (
        <Column
          align="right"
          style={{
            verticalAlign: 'top',
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 12,
            whiteSpace: 'nowrap',
          }}
        >
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
              fontFamily: fonts.body,
            }}
          >
            ★ {item.rating.toFixed(1)}
          </span>
        </Column>
      ) : null}
    </Row>
  );
}
