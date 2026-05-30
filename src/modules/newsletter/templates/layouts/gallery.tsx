import { Column, Link, Row, Section, Text, Img } from '@react-email/components';
import * as React from 'react';
import type { LayoutItemsProps } from './index';
import { posterScaleFactor, type ResolvedItemDisplay } from './index';
import { displayTitle } from '../item-format';

const PER_ROW = 3;
const POSTER_W = 150;
const POSTER_H = 225;
const COL_STYLE = { verticalAlign: 'top' as const, width: `${100 / PER_ROW}%`, padding: 8 };

const DEFAULT_DISPLAY: ResolvedItemDisplay = {
  showPoster: true, showRating: true, showOverview: true, overviewMaxChars: null, posterScale: 'md',
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function GalleryItems({ items, theme, itemDisplay }: LayoutItemsProps) {
  const { palette, fonts, layout } = theme;
  const d = itemDisplay ?? DEFAULT_DISPLAY;
  const posterRadius = Math.min(4, layout.radius);
  const scale = posterScaleFactor(d.posterScale);
  const posterW = Math.round(POSTER_W * scale);
  const posterH = Math.round(POSTER_H * scale);
  const rows = chunk(items, PER_ROW);

  return (
    <Section style={{ marginTop: 12 }}>
      {rows.map(row => (
        <Row key={row.map(i => i.guid).join(',')}>
          {row.map(item => (
            <Column key={item.guid} style={COL_STYLE}>
              {d.showPoster ? (
                item.posterUrl ? (
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
                )
              ) : null}
              <Text
                style={{
                  margin: '8px 0 0',
                  fontFamily: fonts.heading,
                  fontSize: 13,
                  lineHeight: 1.25,
                  fontWeight: layout.headingWeight,
                  color: palette.ink,
                }}
              >
                {item.plexUrl ? (
                  <Link href={item.plexUrl} style={{ color: palette.ink, textDecoration: 'none' }}>
                    {displayTitle(item)}
                  </Link>
                ) : (
                  displayTitle(item)
                )}
              </Text>
            </Column>
          ))}
          {row.length < PER_ROW
            ? Array.from({ length: PER_ROW - row.length }).map((_, i) => (
                <Column key={`pad-${i}`} style={COL_STYLE} />
              ))
            : null}
        </Row>
      ))}
    </Section>
  );
}
