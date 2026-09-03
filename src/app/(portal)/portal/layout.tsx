import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { PORTAL_HOST_HEADER } from '@/modules/portal/constants';
import { renderFooterText } from '@/modules/portal/footer-text';
import { resolvePortalTheme, portalThemeCssVars } from '@/modules/portal/theme';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = getAppContext();
  return { title: ctx.portal.copy.tabTitle };
}

/**
 * Shared chrome for every portal page: theme CSS variables from
 * `resolvePortalTheme`, the server name as the "title", and a minimal
 * footer — no admin nav.
 *
 * This route group has no auth of its own otherwise (session-mode auth
 * lives only in the (admin) layout), so it must draw its own line here:
 *
 * - Genuine portal-host requests (marked by middleware's `x-portal-host`
 *   header — see `constants.ts`) 404 when `portal.enabled` is false, and
 *   render unauthenticated otherwise — this is the actual public site.
 * - Everything else (the admin-host `/portal` preview link) requires an
 *   authenticated admin session; a missing/invalid session 404s rather than
 *   401s, so as not to leak whether the portal exists. Admins get the
 *   preview regardless of `enabled`, with a "disabled" banner when off.
 *
 * Net invariant: an unauthenticated visitor can only ever reach the portal
 * via the portal host with `enabled: true`.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = getAppContext();
  const headerList = await headers();
  const isPortalHostRequest = Boolean(headerList.get(PORTAL_HOST_HEADER));

  if (isPortalHostRequest) {
    if (!ctx.portal.enabled) notFound();
  } else {
    try {
      await requireAdminSession();
    } catch {
      notFound();
    }
  }

  const theme = resolvePortalTheme(ctx.config.newsletter, ctx.portal.appearance);
  const cssVars = portalThemeCssVars(theme);
  const serverName = ctx.config.newsletter.from.name;
  const isDisabledPreview = !ctx.portal.enabled;
  const { showFooter, footer } = ctx.portal.copy;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        ...cssVars,
        backgroundColor: 'var(--portal-paper)',
        color: 'var(--portal-ink)',
      }}
      data-color-scheme={theme.colorScheme}
    >
      {isDisabledPreview ? (
        <div
          className="px-6 py-2 text-center text-xs font-medium sm:px-10"
          style={{
            backgroundColor: 'var(--portal-chip-bg)',
            color: 'var(--portal-chip-fg)',
            borderBottom: '1px solid var(--portal-hairline)',
          }}
        >
          Portal is disabled — this is a preview
        </div>
      ) : null}
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12 lg:px-24">{children}</div>
      </main>
      {showFooter ? (
        <footer>
          <div
            className="mx-auto flex max-w-[1440px] justify-between px-6 py-6 text-xs sm:px-12 lg:px-24"
            style={{ color: 'var(--portal-muted)' }}
          >
            <span className="hidden sm:inline">{serverName}</span>
            <span className="hidden sm:inline">{renderFooterText(footer)}</span>
            <span className="mx-auto sm:hidden">{serverName} · {renderFooterText(footer)}</span>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
