import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { PORTAL_HOST_HEADER } from '@/modules/portal/constants';
import { resolvePortalTheme, portalThemeCssVars } from '@/modules/portal/theme';

export const dynamic = 'force-dynamic';

/**
 * Shared chrome for every portal page: theme CSS variables from
 * `resolvePortalTheme`, the server name as the "title", and a minimal
 * footer — no admin nav.
 *
 * `portal.enabled` gates real portal-host traffic: a genuine request on the
 * configured portal domain (marked by middleware's `x-portal-host` header —
 * see `constants.ts`) 404s the same way everywhere when the portal is off.
 * The admin-host `/portal` route (the "Preview" link in the sidebar) is
 * exempt from that gate so admins can preview disabled portals; it instead
 * renders with a small "disabled" banner.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = getAppContext();
  const headerList = await headers();
  const isPortalHostRequest = Boolean(headerList.get(PORTAL_HOST_HEADER));
  if (!ctx.portal.enabled && isPortalHostRequest) notFound();

  const theme = resolvePortalTheme(ctx.config.newsletter, ctx.portal.appearance);
  const cssVars = portalThemeCssVars(theme);
  const serverName = ctx.config.newsletter.from.name;
  const isDisabledPreview = !ctx.portal.enabled;

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
      <header style={{ borderBottom: '1px solid var(--portal-hairline)' }}>
        <div className="mx-auto max-w-3xl px-6 py-6 sm:px-10">
          <span
            className="text-sm font-semibold tracking-[0.08em] uppercase"
            style={{ color: 'var(--portal-muted)', fontFamily: 'var(--portal-font-heading)' }}
          >
            {serverName}
          </span>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">{children}</div>
      </main>
      <footer style={{ borderTop: '1px solid var(--portal-hairline)' }}>
        <div
          className="mx-auto max-w-3xl px-6 py-6 text-center text-xs sm:px-10"
          style={{ color: 'var(--portal-muted)' }}
        >
          Powered by {serverName}
        </div>
      </footer>
    </div>
  );
}
