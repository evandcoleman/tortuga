import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
};

export function ListItems({ items, theme, itemDisplay }: LayoutItemsProps) {
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  return (
    <>
      {items.map(item => (
        <ItemCard key={item.guid} item={item} theme={theme} display={d} />
      ))}
    </>
  );
}

function ItemCard({ item, theme, display }: { item: EnrichedItem; theme: Theme; display: ResolvedItemDisplay }) {
  const { palette, fonts, layout } = theme;
  const kicker = itemKicker(item);
  const overview = truncate(item.overview, display.overviewMaxChars ?? 220);
  const showsRating = display.showRating && item.rating > 0;
  const title = displayTitle(item);
  const posterRadius = Math.min(4, layout.radius);
  const scale = posterScaleFactor(display.posterScale);
  const posterW = Math.round(88 * scale);
  const posterH = Math.round(132 * scale);
  const colW = Math.round(104 * scale);

  return (
    <Section
      style={{
        marginTop: 20,
        background: palette.cardBg,
        border: `${layout.cardBorderWidth}px solid ${palette.hairline}`,
        borderRadius: layout.radius,
        boxShadow: layout.cardShadow,
        padding: 16,
      }}
    >
      <Row>
        {display.showPoster ? (
          <Column style={{ verticalAlign: 'top', paddingRight: 16, width: colW }}>
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
        ) : null}

        <Column style={{ verticalAlign: 'top' }}>
          {kicker ? (
            <Text
              style={{
                margin: 0,
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: palette.chipFg,
                fontWeight: 600,
              }}
            >
              {kicker}
            </Text>
          ) : null}
          <Heading
            as="h3"
            style={{
              margin: '4px 0 0',
              fontFamily: fonts.heading,
              fontSize: 20,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: palette.ink,
              fontWeight: layout.headingWeight,
            }}
          >
            {title}
          </Heading>

          {showsRating ? (
            <Text style={{ margin: '6px 0 0', fontSize: 12, color: palette.muted }}>
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
                margin: '10px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: palette.ink,
              }}
            >
              {overview}
            </Text>
          ) : null}

          {item.plexUrl ? (
            <Text style={{ margin: '12px 0 0', fontSize: 13 }}>
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
      </Row>
    </Section>
  );
}
