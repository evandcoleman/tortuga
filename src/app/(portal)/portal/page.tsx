import Link from 'next/link';
import { getAppContext } from '@/kernel/context';
import { getPortalBasePath } from '@/modules/portal/base-path';
import { ArrowRightIcon, ArrowUpRightIcon } from '@/modules/portal/icons';
import { PortalHeaderRow } from './_components/portal-header-row';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const ctx = getAppContext();
  const serverName = ctx.config.newsletter.from.name;
  const { entries, copy } = ctx.portal;
  const basePath = await getPortalBasePath();

  return (
    <div>
      <PortalHeaderRow
        serverName={serverName}
        right={
          <span className="hidden text-[13px] sm:inline" style={{ color: 'var(--portal-muted)' }}>
            {copy.tagline}
          </span>
        }
      />
      <div className="flex flex-col gap-4 pt-16 pb-10 sm:gap-5 sm:pt-24 sm:pb-14">
        <h1
          className="m-0 text-[76px] leading-[0.92] font-semibold tracking-[-0.03em] sm:text-[148px]"
          style={{ fontFamily: 'var(--portal-font-heading)' }}
        >
          {serverName}.
        </h1>
        <p
          className="m-0 max-w-[620px] text-lg italic sm:text-2xl"
          style={{ fontFamily: 'var(--portal-font-heading)', color: 'var(--portal-muted)', lineHeight: 1.4 }}
        >
          {copy.intro}
        </p>
      </div>

      <div className="flex flex-col pb-16 sm:pb-20">
        {entries.map((entry, index) => {
          const href = entry.external ? entry.href : `${basePath}/${entry.href}`;
          const isLast = index === entries.length - 1;
          const Icon = entry.external ? ArrowUpRightIcon : ArrowRightIcon;
          return (
            <Link
              key={`${entry.kind}:${entry.id}`}
              href={href}
              {...(entry.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              data-testid="portal-home-row"
              data-external={entry.external}
              className="grid grid-cols-[40px_minmax(0,1fr)_28px] items-center gap-3 py-5 transition-colors sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_48px] sm:gap-6 sm:px-2 sm:py-7 hover:[background-color:var(--portal-card-bg)]"
              style={{
                borderTop: '1px solid var(--portal-rule)',
                borderBottom: isLast ? '1px solid var(--portal-rule)' : undefined,
                color: 'var(--portal-ink)',
              }}
            >
              <span className="text-xs tracking-[0.15em]" style={{ color: 'var(--portal-accent)' }}>
                {entry.number}
              </span>
              <span className="flex flex-col gap-1 sm:contents">
                <span
                  className="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[40px]"
                  style={{ fontFamily: 'var(--portal-font-heading)' }}
                >
                  {entry.label}
                </span>
                {entry.description ? (
                  <span className="text-[13px] leading-[1.45] sm:text-[15px] sm:leading-[1.5]" style={{ color: 'var(--portal-muted)' }}>
                    {entry.description}
                  </span>
                ) : null}
              </span>
              <Icon
                className="justify-self-end"
                style={{ color: entry.external ? 'var(--portal-muted)' : 'var(--portal-ink)' }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
