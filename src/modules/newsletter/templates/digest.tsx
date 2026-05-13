import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text, Hr } from '@react-email/components';
import * as React from 'react';
import type { EnrichedItem } from '../types';

export interface DigestEmailProps {
  items: EnrichedItem[];
  unsubscribeUrl: string;
  appName: string;
}

export function DigestEmail({ items, unsubscribeUrl, appName }: DigestEmailProps) {
  const sections = new Map<string, EnrichedItem[]>();
  for (const it of items) {
    const list = sections.get(it.libraryName) ?? [];
    list.push(it);
    sections.set(it.libraryName, list);
  }
  return (
    <Html>
      <Head />
      <Preview>{`New on ${appName} this week — ${items.length} items`}</Preview>
      <Body style={{ background: '#0f1115', color: '#e7e9ee', fontFamily: 'ui-sans-serif, system-ui, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
          <Heading as="h1" style={{ margin: 0, fontSize: 28, letterSpacing: -0.5 }}>New on {appName}</Heading>
          <Text style={{ color: '#9aa4b2', marginTop: 4 }}>Here&apos;s what landed this week.</Text>
          {Array.from(sections.entries()).map(([library, group]) => (
            <Section key={library} style={{ marginTop: 32 }}>
              <Heading as="h2" style={{ fontSize: 18, color: '#cdd5e0', borderBottom: '1px solid #1e242e', paddingBottom: 8 }}>
                {library}
              </Heading>
              {group.map(item => (
                <Section key={item.guid} style={{ marginTop: 16 }}>
                  {item.posterUrl && (
                    <Img src={item.posterUrl} alt="" width={96} height={144} style={{ borderRadius: 6 }} />
                  )}
                  <Text style={{ fontWeight: 600, fontSize: 16, margin: '8px 0 0' }}>
                    {item.title}{item.year ? <span style={{ color: '#9aa4b2', fontWeight: 400 }}>{` (${item.year})`}</span> : null}
                  </Text>
                  {item.episodeCount ? (
                    <Text style={{ color: '#9aa4b2', margin: '4px 0' }}>
                      {item.episodeCount} new episode{item.episodeCount === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                  {item.rating > 0 ? (
                    <Text style={{ color: '#9aa4b2', margin: '4px 0' }}>&#9733; {item.rating.toFixed(1)}</Text>
                  ) : null}
                  <Text style={{ color: '#cdd5e0', margin: '8px 0 0', fontSize: 14 }}>
                    {item.overview.length > 280 ? item.overview.slice(0, 277) + '…' : item.overview}
                  </Text>
                </Section>
              ))}
            </Section>
          ))}
          <Hr style={{ borderColor: '#1e242e', marginTop: 40 }} />
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>
            You&apos;re receiving this because you have access to {appName}.{' '}
            <Link href={unsubscribeUrl} style={{ color: '#9aa4b2' }}>Unsubscribe</Link>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
