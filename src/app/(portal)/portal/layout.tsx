import { notFound } from 'next/navigation';
import { getAppContext } from '@/kernel/context';
import { resolvePortalTheme, portalThemeCssVars } from '@/modules/portal/theme';

export const dynamic = 'force-dynamic';

/**
 * Shared chrome for every portal page: theme CSS variables from
 * `resolvePortalTheme`, the server name as the "title", and a minimal
 * footer — no admin nav. `portal.enabled` is checked once, here, so every
 * page under `/portal/*` 404s the same way when the portal is off,
 * regardless of which host served the request (see spec "Serving model").
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = getAppContext();
  if (!ctx.portal.enabled) notFound();

  const theme = resolvePortalTheme(ctx.config.newsletter, ctx.portal.appearance);
  const cssVars = portalThemeCssVars(theme);
  const serverName = ctx.config.newsletter.from.name;

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
