import { Heading, Img, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

const POSTER_W = 584;
const POSTER_H = 328;

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
};

export function MagazineItems({ items, theme, itemDisplay }: LayoutItemsProps) {
  const { palette, fonts, layout } = theme;
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  const scale = posterScaleFactor(d.posterScale);
  const posterW = Math.round(POSTER_W * scale);
  const posterH = Math.round(POSTER_H * scale);
  return (
    <>
      {items.map(item => {
        const kicker = itemKicker(item);
        const overview = truncate(item.overview, d.overviewMaxChars ?? 360);
        const showsRating = d.showRating && item.rating > 0;
        return (
          <Section key={item.guid} style={{ marginTop: 24 }}>
            {d.showPoster && item.posterUrl ? (
              <Img
                src={item.posterUrl}
                alt=""
                width={posterW}
                height={posterH}
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
            {showsRating ? (
              <Text style={{ margin: '6px 0 0', fontSize: 12, color: palette.muted }}>
                ★ {item.rating.toFixed(1)}
              </Text>
            ) : null}
            {d.showOverview && overview ? (
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
