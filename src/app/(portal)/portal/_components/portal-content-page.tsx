import Link from 'next/link';

export interface PortalContentPageProps {
  title: string;
  /** Already-rendered HTML (substitution + markdown, or admin-authored HTML — both trusted). */
  html: string;
  homeHref: string;
}

/** Shared prose chrome for the three built-in content pages and custom pages. */
export function PortalContentPage({ title, html, homeHref }: PortalContentPageProps) {
  return (
    <article>
      <Link
        href={homeHref}
        className="mb-8 inline-block text-sm font-medium opacity-70 hover:opacity-100"
        style={{ color: 'var(--portal-accent)' }}
      >
        ← Back
      </Link>
      <h1
        className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ fontFamily: 'var(--portal-font-heading)' }}
      >
        {title}
      </h1>
      <div
        className="portal-prose max-w-none"
        style={{ fontFamily: 'var(--portal-font-body)' }}
        // Content is either the app's own rendered markdown or admin-authored HTML — both trusted (see spec).
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
