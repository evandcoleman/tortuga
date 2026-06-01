import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { itemKicker, truncate, displayTitle } from '../item-format';

const HERO_POSTER_W = 168;
const HERO_POSTER_H = 252;

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
};

export function SpotlightItems({ items, theme, itemDisplay }: LayoutItemsProps) {
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  if (items.length === 0) return null;

  const [hero, ...rest] = items;

  return (
    <>
      <HeroFeature item={hero} theme={theme} display={d} />
      {rest.length > 0 ? <Rundown items={rest} theme={theme} display={d} /> : null}
    </>
  );
}

function HeroFeature({ item, theme, display }: { item: EnrichedItem; theme: Theme; display: ResolvedItemDisplay }) {
  const { palette, fonts, layout } = theme;
  const kicker = itemKicker(item);
  const overview = truncate(item.overview, display.overviewMaxChars ?? 320);
  const showsRating = display.showRating && item.rating > 0;
  const title = displayTitle(item);
  const posterRadius = Math.min(6, layout.radius);
  const scale = posterScaleFactor(display.posterScale);
  const posterW = Math.round(HERO_POSTER_W * scale);
  const posterH = Math.round(HERO_POSTER_H * scale);
  const colW = Math.round((HERO_POSTER_W + 24) * scale);

  return (
    <Section
      style={{
        marginTop: 16,
        background: palette.cardBg,
        border: `${layout.cardBorderWidth}px solid ${palette.hairline}`,
        borderRadius: layout.radius,
        boxShadow: layout.cardShadow,
        padding: 20,
      }}
    >
      <Row>
        {display.showPoster ? (
          <Column style={{ verticalAlign: 'top', paddingRight: 20, width: colW }}>
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
          <Text
            style={{
              margin: 0,
              fontSize: 10,
              letterSpacing: layout.eyebrowLetterSpacing,
              textTransform: 'uppercase',
              color: palette.accent,
              fontWeight: 700,
            }}
          >
            {kicker ? `Tonight's pick · ${kicker}` : "Tonight's pick"}
          </Text>

          <Heading
            as="h2"
            style={{
              margin: '8px 0 0',
              fontFamily: fonts.heading,
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: layout.headingLetterSpacing,
              color: palette.ink,
              fontWeight: layout.headingWeight,
            }}
          >
            {title}
          </Heading>

          {showsRating ? (
            <Text style={{ margin: '10px 0 0', fontSize: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: layout.radius === 0 ? 0 : 999,
                  background: palette.chipBg,
                  color: palette.chipFg,
                  fontSize: 11,
                  fontWeight: 700,
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
                fontFamily: fonts.body,
                fontSize: 15,
                lineHeight: 1.6,
                color: palette.ink,
              }}
            >
              {overview}
            </Text>
          ) : null}

          {item.plexUrl ? (
            <Text style={{ margin: '16px 0 0', fontSize: 13 }}>
              <Link
                href={item.plexUrl}
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  borderRadius: layout.radius === 0 ? 0 : 999,
                  background: palette.accent,
                  color: palette.onAccent,
                  textDecoration: 'none',
                  fontWeight: 700,
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

function Rundown({ items, theme, display }: { items: EnrichedItem[]; theme: Theme; display: ResolvedItemDisplay }) {
  const { palette, fonts, layout } = theme;

  return (
    <Section
      style={{
        marginTop: 16,
        background: palette.cardBg,
        border: `${layout.cardBorderWidth}px solid ${palette.hairline}`,
        borderRadius: layout.radius,
        padding: '4px 16px',
      }}
    >
      <Text
        style={{
          margin: '10px 0 2px',
          fontSize: 10,
          letterSpacing: layout.eyebrowLetterSpacing,
          textTransform: 'uppercase',
          color: palette.muted,
          fontWeight: 700,
        }}
      >
        Also arriving
      </Text>
      {items.map((item, i) => {
        const kicker = itemKicker(item);
        const showsRating = display.showRating && item.rating > 0;
        const isLast = i === items.length - 1;
        return (
          <Row
            key={item.guid}
            style={isLast ? undefined : { borderBottom: `${layout.ruleWidth}px solid ${palette.hairline}` }}
          >
            <Column style={{ verticalAlign: 'baseline', padding: '10px 0' }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontFamily: fonts.heading,
                  fontWeight: layout.headingWeight,
                  color: palette.ink,
                  lineHeight: 1.3,
                }}
              >
                {item.plexUrl ? (
                  <Link href={item.plexUrl} style={{ color: palette.ink, textDecoration: 'none' }}>
                    {displayTitle(item)}
                  </Link>
                ) : (
                  displayTitle(item)
                )}
                {kicker ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: palette.muted,
                      fontFamily: fonts.body,
                    }}
                  >
                    {' · '}
                    {kicker}
                  </span>
                ) : null}
              </Text>
            </Column>
            {showsRating ? (
              <Column align="right" style={{ verticalAlign: 'baseline', padding: '10px 0' }}>
                <Text style={{ margin: 0, fontSize: 12, color: palette.chipFg }}>
                  ★ {item.rating.toFixed(1)}
                </Text>
              </Column>
            ) : null}
          </Row>
        );
      })}
    </Section>
  );
}
