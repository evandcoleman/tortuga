/**
 * Shared masthead header row: the server-name eyebrow on the left, plus a
 * caller-supplied right slot. The home page passes the tagline; content
 * pages pass the "Back to index" link — each caller controls its own
 * responsive visibility (e.g. `hidden sm:inline`) on the right node.
 *
 * Padding-agnostic by design: this component adds no horizontal padding or
 * max-width of its own. Every caller already renders it as a direct child
 * of the shared, already-padded portal content container (see
 * `(portal)/portal/layout.tsx`), so adding padding here would double it up
 * against that container's edge — which is exactly what left the eyebrow
 * inset further than the page title and footer. Callers place it at the
 * same nesting depth as their heading content, not inside any extra
 * padded wrapper.
 */
export interface PortalHeaderRowProps {
  serverName: string;
  right: React.ReactNode;
}

export function PortalHeaderRow({ serverName, right }: PortalHeaderRowProps) {
  return (
    <header className="flex items-center justify-between pt-7">
      <span
        className="text-[13px] tracking-[0.3em] uppercase"
        style={{ color: 'var(--portal-muted)', fontFamily: 'var(--portal-font-heading)' }}
      >
        {serverName} · Plex
      </span>
      {right}
    </header>
  );
}
