import Link from 'next/link';
import { getAppContext } from '@/kernel/context';
import { buildHomeButtons } from '@/modules/portal/home-buttons';
import { getPortalBasePath } from '@/modules/portal/base-path';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const ctx = getAppContext();
  const buttons = buildHomeButtons(ctx.portal);
  const basePath = await getPortalBasePath();

  return (
    <div>
      <h1
        className="mb-3 text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ fontFamily: 'var(--portal-font-heading)' }}
      >
        {ctx.config.newsletter.from.name}
      </h1>
      <p className="mb-12 text-base" style={{ color: 'var(--portal-muted)' }}>
        Everything you need, in one place.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {buttons.map((button) => {
          const href = button.external ? button.href : `${basePath}/${button.href}`;
          return (
            <Link
              key={`${button.external ? 'external' : 'internal'}:${button.href}`}
              href={href}
              {...(button.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group flex items-center justify-between px-6 py-5 text-lg font-medium shadow-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--portal-accent)',
                color: 'var(--portal-on-accent)',
                borderRadius: 'var(--portal-radius)',
              }}
            >
              <span>{button.label}</span>
              <span aria-hidden className="opacity-70 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
