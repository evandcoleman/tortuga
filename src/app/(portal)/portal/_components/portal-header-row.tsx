/**
 * Shared masthead header row: the server-name eyebrow on the left, plus a
 * caller-supplied right slot. The home page passes the tagline; content
 * pages pass the "Back to index" link — each caller controls its own
 * responsive visibility (e.g. `hidden sm:inline`) on the right node.
 */
export interface PortalHeaderRowProps {
  serverName: string;
  right: React.ReactNode;
}

export function PortalHeaderRow({ serverName, right }: PortalHeaderRowProps) {
  return (
    <header>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 pt-7 sm:px-12 lg:px-24">
        <span
          className="text-[13px] tracking-[0.3em] uppercase"
          style={{ color: 'var(--portal-muted)', fontFamily: 'var(--portal-font-heading)' }}
        >
          {serverName} · Plex
        </span>
        {right}
      </div>
    </header>
  );
}
