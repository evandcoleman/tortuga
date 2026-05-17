import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../types';

export interface DigestEmailProps {
  items: EnrichedItem[];
  unsubscribeUrl: string;
  appName: string;
  windowStart: Date;
  windowEnd: Date;
}

const PALETTE = {
  paper: '#faf8f4',
  ink: '#161410',
  muted: '#5d564b',
  rule: '#e3ddd0',
  hairline: '#ece6d8',
  accent: '#b07a1e',
  cardBg: '#ffffff',
  chipBg: '#f3eedf',
  chipFg: '#7a5d24',
} as const;

const FONT_SERIF =
  '"Iowan Old Style","Apple Garamond","Baskerville","Times New Roman","Droid Serif","Times","Source Serif Pro",serif';
const FONT_SANS = '"Inter","Helvetica Neue","Helvetica","Arial",sans-serif';

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', opts).format(d);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${fmt(start, { month: 'long', day: 'numeric' })}–${fmt(end, { day: 'numeric', year: 'numeric' })}`;
  }
  if (sameYear) {
    return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return `${fmt(start, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function itemKicker(item: EnrichedItem): string | null {
  const bits: string[] = [];
  if (item.mediaType === 'movie') bits.push('Film');
  if (item.mediaType === 'show') bits.push('Series');
  if (item.mediaType === 'season' && typeof item.seasonNumber === 'number') {
    bits.push(`Season ${item.seasonNumber}`);
  }
  if (item.episodeCount) {
    bits.push(`${item.episodeCount} new episode${item.episodeCount === 1 ? '' : 's'}`);
  }
  if (item.year) bits.push(String(item.year));
  return bits.length > 0 ? bits.join(' · ') : null;
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function DigestEmail({
  items,
  unsubscribeUrl,
  appName,
  windowStart,
  windowEnd,
}: DigestEmailProps) {
  const sections = new Map<string, EnrichedItem[]>();
  for (const it of items) {
    const list = sections.get(it.libraryName) ?? [];
    list.push(it);
    sections.set(it.libraryName, list);
  }
  const dateRange = formatDateRange(windowStart, windowEnd);
  const itemNoun = items.length === 1 ? 'addition' : 'additions';

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{`${items.length} new on ${appName} · ${dateRange}`}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: PALETTE.paper,
          color: PALETTE.ink,
          fontFamily: FONT_SANS,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '40px 28px 56px',
            background: PALETTE.paper,
          }}
        >
          <Section>
            <Text
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: PALETTE.accent,
                fontWeight: 600,
              }}
            >
              {appName} · Weekly
            </Text>
            <Heading
              as="h1"
              style={{
                margin: '10px 0 0',
                fontFamily: FONT_SERIF,
                fontSize: 36,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: PALETTE.ink,
                fontWeight: 600,
              }}
            >
              New on {appName}
            </Heading>
            <Text
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                color: PALETTE.muted,
              }}
            >
              {dateRange} · {items.length} {itemNoun}
            </Text>
          </Section>

          <Hr
            style={{
              borderColor: PALETTE.rule,
              borderStyle: 'solid',
              borderWidth: '0 0 1px',
              margin: '28px 0 0',
            }}
          />

          {Array.from(sections.entries()).map(([library, group]) => (
            <Section key={library} style={{ marginTop: 32 }}>
              <Row>
                <Column>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: 10,
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    {library}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ margin: 0, fontSize: 11, color: PALETTE.muted }}>
                    {group.length} {group.length === 1 ? 'title' : 'titles'}
                  </Text>
                </Column>
              </Row>
              <Hr
                style={{
                  borderColor: PALETTE.hairline,
                  borderStyle: 'solid',
                  borderWidth: '0 0 1px',
                  margin: '8px 0 0',
                }}
              />

              {group.map(item => (
                <ItemCard key={item.guid} item={item} />
              ))}
            </Section>
          ))}

          <Hr
            style={{
              borderColor: PALETTE.rule,
              borderStyle: 'solid',
              borderWidth: '0 0 1px',
              margin: '48px 0 20px',
            }}
          />
          <Text
            style={{
              margin: 0,
              fontSize: 11,
              color: PALETTE.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {appName}
          </Text>
          <Text
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: PALETTE.muted,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            You&apos;re receiving this because you have access to {appName}.
            <br />
            <Link
              href={unsubscribeUrl}
              style={{ color: PALETTE.muted, textDecoration: 'underline' }}
            >
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function ItemCard({ item }: { item: EnrichedItem }) {
  const kicker = itemKicker(item);
  const overview = truncate(item.overview, 220);
  const showsRating = item.rating > 0;
  const displayTitle =
    item.mediaType === 'season' && item.showTitle ? item.showTitle : item.title;

  return (
    <Section
      style={{
        marginTop: 20,
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.hairline}`,
        borderRadius: 6,
        padding: 16,
      }}
    >
      <Row>
        <Column
          style={{ verticalAlign: 'top', paddingRight: 16, width: 104 }}
        >
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
                borderRadius: 4,
                border: `1px solid ${PALETTE.hairline}`,
                background: PALETTE.chipBg,
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 132,
                borderRadius: 4,
                background: PALETTE.chipBg,
                border: `1px dashed ${PALETTE.rule}`,
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
                color: PALETTE.chipFg,
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
              fontFamily: FONT_SERIF,
              fontSize: 20,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: PALETTE.ink,
              fontWeight: 600,
            }}
          >
            {displayTitle}
          </Heading>

          {showsRating ? (
            <Text style={{ margin: '6px 0 0', fontSize: 12, color: PALETTE.muted }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: PALETTE.chipBg,
                  color: PALETTE.chipFg,
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
                color: PALETTE.ink,
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
                  color: PALETTE.accent,
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
