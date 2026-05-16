import Link from 'next/link';
import { Card, PageHeader } from '../_components/ui';

type Tile = {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
};

const tiles: ReadonlyArray<Tile> = [
  {
    href: '/newsletter/preview',
    title: 'Preview & send',
    description: 'Render this week’s digest as a dry-run, then ship when it looks right.',
    cta: 'Open preview',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path
          d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    href: '/newsletter/history',
    title: 'Send history',
    description: 'Past digests and per-recipient delivery results across providers.',
    cta: 'View history',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v4h4" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: '/newsletter/recipients',
    title: 'Recipients',
    description: 'Subscribers synced from Plex, plus unsubscribe state.',
    cta: 'Manage recipients',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="8" r="3.25" />
        <path d="M2.75 19a6.25 6.25 0 0 1 12.5 0" />
        <path d="M16 11a3 3 0 1 0 0-6" />
        <path d="M21.25 18a5.5 5.5 0 0 0-4.5-5.4" />
      </svg>
    ),
  },
];

export default function NewsletterIndex() {
  return (
    <div>
      <PageHeader
        eyebrow="Newsletter"
        title="Run the digest."
        description="Tortuga compiles your weekly Plex digest, then hands it off to your configured email provider. Use the tools below to preview, send, and review delivery."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tiles.map(t => (
          <Link key={t.href} href={t.href} className="group block">
            <Card className="h-full transition group-hover:border-line-strong group-hover:bg-elevated">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-elevated text-gold ring-1 ring-line">
                {t.icon}
              </div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{t.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{t.description}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-gold transition group-hover:gap-2">
                {t.cta}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
