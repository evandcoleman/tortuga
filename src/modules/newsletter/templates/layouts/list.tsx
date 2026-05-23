import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { LayoutItemsProps } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

export function ListItems({ items, theme }: LayoutItemsProps) {
  return (
    <>
      {items.map(item => (
        <ItemCard key={item.guid} item={item} theme={theme} />
      ))}
    </>
  );
}

function ItemCard({ item, theme }: { item: EnrichedItem; theme: Theme }) {
  const { palette, fonts, layout } = theme;
  const kicker = itemKicker(item);
  const overview = truncate(item.overview, 220);
  const showsRating = item.rating > 0;
  const title = displayTitle(item);
  const posterRadius = Math.min(4, layout.radius);

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
        <Column style={{ verticalAlign: 'top', paddingRight: 16, width: 104 }}>
          {item.posterUrl ? (
            <Img
              src={item.posterUrl}
              alt=""
              width={88}
              height={132}
              style={{
                display: 'block',
                width: 88,
                height: 132,
                borderRadius: posterRadius,
                border: `1px solid ${palette.hairline}`,
                background: palette.chipBg,
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 132,
                borderRadius: posterRadius,
                background: palette.chipBg,
                border: `1px dashed ${palette.rule}`,
              }}
            />
          )}
        </Column>

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

          {overview ? (
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
