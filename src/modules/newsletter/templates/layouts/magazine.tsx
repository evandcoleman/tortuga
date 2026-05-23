import { Heading, Img, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { LayoutItemsProps } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

const POSTER_W = 584;
const POSTER_H = 328;

export function MagazineItems({ items, theme }: LayoutItemsProps) {
  const { palette, fonts, layout } = theme;
  return (
    <>
      {items.map(item => {
        const kicker = itemKicker(item);
        const overview = truncate(item.overview, 360);
        return (
          <Section key={item.guid} style={{ marginTop: 24 }}>
            {item.posterUrl ? (
              <Img
                src={item.posterUrl}
                alt=""
                width={POSTER_W}
                height={POSTER_H}
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: Math.min(8, layout.radius),
                  border: `1px solid ${palette.hairline}`,
                }}
              />
            ) : null}
            {kicker ? (
              <Text
                style={{
                  margin: '14px 0 0',
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
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: layout.headingLetterSpacing,
                color: palette.ink,
                fontWeight: layout.headingWeight,
              }}
            >
              {displayTitle(item)}
            </Heading>
            {item.rating > 0 ? (
              <Text style={{ margin: '6px 0 0', fontSize: 12, color: palette.muted }}>
                ★ {item.rating.toFixed(1)}
              </Text>
            ) : null}
            {overview ? (
              <Text style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: palette.ink }}>
                {overview}
              </Text>
            ) : null}
            {item.plexUrl ? (
              <Text style={{ margin: '12px 0 0', fontSize: 13 }}>
                <Link
                  href={item.plexUrl}
                  style={{ color: palette.accent, textDecoration: 'none', fontWeight: 600 }}
                >
                  Open in Plex →
                </Link>
              </Text>
            ) : null}
          </Section>
        );
      })}
    </>
  );
}
