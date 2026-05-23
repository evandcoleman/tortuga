import { Column, Link, Row, Section, Text, Img } from '@react-email/components';
import * as React from 'react';
import type { LayoutItemsProps } from './index';
import { displayTitle } from '../item-format';

const PER_ROW = 3;
const POSTER_W = 150;
const POSTER_H = 225;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function GalleryItems({ items, theme }: LayoutItemsProps) {
  const { palette, fonts, layout } = theme;
  const posterRadius = Math.min(4, layout.radius);
  const rows = chunk(items, PER_ROW);
  const colStyle = { verticalAlign: 'top' as const, width: `${100 / PER_ROW}%`, padding: 8 };

  return (
    <Section style={{ marginTop: 12 }}>
      {rows.map((row, ri) => (
        <Row key={ri}>
          {row.map(item => (
            <Column key={item.guid} style={colStyle}>
              {item.posterUrl ? (
                <Img
                  src={item.posterUrl}
                  alt=""
                  width={POSTER_W}
                  height={POSTER_H}
                  style={{
                    display: 'block',
                    width: POSTER_W,
                    height: POSTER_H,
                    borderRadius: posterRadius,
                    border: `1px solid ${palette.hairline}`,
                    background: palette.chipBg,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: POSTER_W,
                    height: POSTER_H,
                    borderRadius: posterRadius,
                    background: palette.chipBg,
                    border: `1px dashed ${palette.rule}`,
                  }}
                />
              )}
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
                <Column key={`pad-${i}`} style={colStyle} />
              ))
            : null}
        </Row>
      ))}
    </Section>
  );
}
