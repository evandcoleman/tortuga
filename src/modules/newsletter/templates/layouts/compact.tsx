import { Column, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { LayoutItemsProps } from './index';
import { itemKicker, displayTitle } from '../item-format';

export function CompactItems({ items, theme }: LayoutItemsProps) {
  const { palette, fonts, layout } = theme;
  return (
    <Section style={{ marginTop: 8 }}>
      {items.map(item => {
        const kicker = itemKicker(item);
        return (
          <Row key={item.guid} style={{ borderBottom: `1px solid ${palette.hairline}` }}>
            <Column style={{ verticalAlign: 'baseline', padding: '8px 0' }}>
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
            {item.rating > 0 ? (
              <Column align="right" style={{ verticalAlign: 'baseline', padding: '8px 0' }}>
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
