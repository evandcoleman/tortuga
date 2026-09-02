import Link from 'next/link';
import { getAppContext } from '@/kernel/context';
import { buildHomeButtons } from '@/modules/portal/home-buttons';
import { getPortalBasePath } from '@/modules/portal/base-path';
import { ArrowRightIcon, ArrowUpRightIcon } from '@/modules/portal/icons';
import { PortalHeaderRow } from './_components/portal-header-row';

export const dynamic = 'force-dynamic';

function numeral(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export default async function PortalHome() {
  const ctx = getAppContext();
  const serverName = ctx.config.newsletter.from.name;
  const buttons = buildHomeButtons(ctx.portal, serverName);
  const basePath = await getPortalBasePath();

  return (
    <div>
      <PortalHeaderRow
        serverName={serverName}
        right={
          <span className="hidden text-[13px] sm:inline" style={{ color: 'var(--portal-muted)' }}>
            A private server for friends and family
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
          Everything you need to get set up, find your way around, and get help when something breaks.
        </p>
      </div>

      <div className="flex flex-col pb-16 sm:pb-20">
        {buttons.map((button, index) => {
          const href = button.external ? button.href : `${basePath}/${button.href}`;
          const isLast = index === buttons.length - 1;
          const Icon = button.external ? ArrowUpRightIcon : ArrowRightIcon;
          return (
            <Link
              key={`${button.external ? 'external' : 'internal'}:${button.href}`}
              href={href}
              {...(button.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              data-testid="portal-home-row"
              data-external={button.external}
              className="grid grid-cols-[40px_minmax(0,1fr)_28px] items-center gap-3 py-5 transition-colors sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_48px] sm:gap-6 sm:px-2 sm:py-7 hover:[background-color:var(--portal-card-bg)]"
              style={{
                borderTop: '1px solid var(--portal-rule)',
                borderBottom: isLast ? '1px solid var(--portal-rule)' : undefined,
                color: 'var(--portal-ink)',
              }}
            >
              <span className="text-xs tracking-[0.15em]" style={{ color: 'var(--portal-accent)' }}>
                {numeral(index)}
              </span>
              <span className="flex flex-col gap-1 sm:contents">
                <span
                  className="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[40px]"
                  style={{ fontFamily: 'var(--portal-font-heading)' }}
                >
                  {button.label}
                </span>
                {button.description ? (
                  <span className="text-[13px] leading-[1.45] sm:text-[15px] sm:leading-[1.5]" style={{ color: 'var(--portal-muted)' }}>
                    {button.description}
                  </span>
                ) : null}
              </span>
              <Icon
                className="justify-self-end"
                style={{ color: button.external ? 'var(--portal-muted)' : 'var(--portal-ink)' }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
