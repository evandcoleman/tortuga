import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../../types';
import type { Theme } from '../themes';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { itemKicker, truncate, displayTitle, leavesLabel } from '../item-format';

const RAIL_WIDTH = 64;
const POSTER_W = 56;
const POSTER_H = 84;

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
};

// The rail carries a date-like label. For a "leaving soon" item the removal
// date (in the digest timezone) takes priority over the added date, since that
// is the more actionable date for that section. EnrichedItem.addedAt is
// otherwise the chronological anchor for a "what's new" digest; when it is
// absent or unparseable we fall back to the item kicker so the spine never
// renders a blank marker.
function railLabels(item: EnrichedItem, timezone?: string): { primary: string; secondary: string | null } {
  if (item.leavesAt) {
    return { primary: leavesLabel(item.leavesAt, timezone), secondary: null };
  }
  const added = item.addedAt ? new Date(item.addedAt) : null;
  if (added && !Number.isNaN(added.getTime())) {
    const month = added.toLocaleDateString('en-US', { month: 'short' });
    const day = String(added.getDate());
    const year = String(added.getFullYear());
    return { primary: `${month} ${day}`, secondary: year };
  }
  const kicker = itemKicker(item, timezone);
  return { primary: kicker ?? 'New', secondary: null };
}

export function TimelineItems({ items, theme, itemDisplay, timezone }: LayoutItemsProps) {
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  if (items.length === 0) return null;
  return (
    <Section style={{ marginTop: 12 }}>
      {items.map((item, i) => (
        <TimelineEntry
          key={item.guid}
          item={item}
          theme={theme}
          display={d}
          isLast={i === items.length - 1}
          timezone={timezone}
        />
      ))}
    </Section>
  );
}

function TimelineEntry({
  item,
  theme,
  display,
  isLast,
  timezone,
}: {
  item: EnrichedItem;
  theme: Theme;
  display: ResolvedItemDisplay;
  isLast: boolean;
  timezone?: string;
}) {
  const { palette, fonts, layout } = theme;
  // The rail already carries the "Leaves …" label for leaving items (see
  // railLabels), so the eyebrow kicker must not repeat it.
  const kicker = itemKicker(item, timezone, { includeLeaves: false });
  const overview = truncate(item.overview, display.overviewMaxChars ?? 200);
  const showsRating = display.showRating && item.rating > 0;
  const title = displayTitle(item);
  const { primary, secondary } = railLabels(item, timezone);

  const scale = posterScaleFactor(display.posterScale);
  const posterW = Math.round(POSTER_W * scale);
  const posterH = Math.round(POSTER_H * scale);
  const posterRadius = Math.min(4, layout.radius);

  // A continuous hairline spine: the rail column's right border bleeds the full
  // height of every entry except the final one, joining consecutive markers.
  const spineBorder = isLast ? undefined : `${layout.ruleWidth}px solid ${palette.hairline}`;

  return (
    <Row>
      <Column
        style={{
          verticalAlign: 'top',
          width: RAIL_WIDTH,
          paddingTop: 4,
          paddingBottom: isLast ? 0 : 24,
          paddingRight: 14,
          borderRight: spineBorder,
        }}
      >
        <Text style={{ margin: 0, lineHeight: 1 }}>
          <span
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: 999,
              background: palette.accent,
              border: `2px solid ${palette.paper}`,
            }}
          />
        </Text>
        <Text
          style={{
            margin: '8px 0 0',
            fontFamily: fonts.body,
            fontSize: 11,
            lineHeight: 1.2,
            fontWeight: 600,
            color: palette.ink,
          }}
        >
          {primary}
        </Text>
        {secondary ? (
          <Text
            style={{
              margin: '2px 0 0',
              fontFamily: fonts.body,
              fontSize: 10,
              lineHeight: 1.2,
              color: palette.muted,
            }}
          >
            {secondary}
          </Text>
        ) : null}
      </Column>

      <Column
        style={{
          verticalAlign: 'top',
          paddingLeft: 18,
          paddingTop: 0,
          paddingBottom: isLast ? 0 : 24,
        }}
      >
        {kicker ? (
          <Text
            style={{
              margin: 0,
              fontSize: 10,
              letterSpacing: layout.eyebrowLetterSpacing,
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
            fontSize: 18,
            lineHeight: 1.25,
            letterSpacing: layout.headingLetterSpacing,
            color: palette.ink,
            fontWeight: layout.headingWeight,
          }}
        >
          {title}
        </Heading>

        {display.showPoster ? (
          <Row style={{ marginTop: 10 }}>
            <Column style={{ verticalAlign: 'top', width: posterW + 14, paddingRight: 14 }}>
              {item.posterUrl ? (
                <Img
                  src={item.posterUrl}
                  alt={title}
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
            <Column style={{ verticalAlign: 'top' }}>
              {showsRating ? (
                <Text style={{ margin: 0, fontSize: 12, color: palette.muted }}>
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
                    margin: showsRating ? '8px 0 0' : 0,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: palette.ink,
                  }}
                >
                  {overview}
                </Text>
              ) : null}
            </Column>
          </Row>
        ) : (
          <>
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
              <Text style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: palette.ink }}>
                {overview}
              </Text>
            ) : null}
          </>
        )}

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
  );
}
