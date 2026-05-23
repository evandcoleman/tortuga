'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: 'dashboard' | 'mail' | 'eye' | 'history' | 'users' | 'settings';
};

const items: ReadonlyArray<NavItem> = [
  { href: '/', label: 'Dashboard', exact: true, icon: 'dashboard' },
  { href: '/newsletter', label: 'Newsletter', exact: true, icon: 'mail' },
  { href: '/newsletter/preview', label: 'Preview', icon: 'eye' },
  { href: '/newsletter/history', label: 'History', icon: 'history' },
  { href: '/newsletter/recipients', label: 'Recipients', icon: 'users' },
  { href: '/settings', label: 'Settings', exact: true, icon: 'settings' },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export interface SidebarProps {
  userEmail?: string | null;
  providerName?: string;
  authMode: 'session' | 'forward';
  signOutAction?: () => void | Promise<void>;
}

export function Sidebar({ userEmail, providerName, authMode, signOutAction }: SidebarProps) {
  const pathname = usePathname() ?? '/';

  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-3 px-6 py-6">
        <Logo />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Tortuga</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-faint">Plex Concierge</div>
        </div>
      </div>

      <nav className="px-3">
        <SectionLabel>Workspace</SectionLabel>
        <ul className="mb-2 grid gap-0.5">
          {items.slice(0, 1).map(it => (
            <NavLink key={it.href} item={it} active={isActive(pathname, it)} />
          ))}
        </ul>
        <SectionLabel>Newsletter</SectionLabel>
        <ul className="grid gap-0.5">
          {items.slice(1).map(it => (
            <NavLink key={it.href} item={it} active={isActive(pathname, it)} />
          ))}
        </ul>
      </nav>

      <div className="mt-auto border-t border-line px-3 py-3">
        <div className="mb-2 rounded-md bg-surface px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">
            <Dot className="text-success" />
            Online
          </div>
          <div className="text-[11px] text-muted">
            Provider <span className="text-fg">{providerName ?? '—'}</span>
            <span className="px-1 text-faint">·</span>
            Auth <span className="text-fg">{authMode}</span>
          </div>
        </div>
        {authMode === 'session' && signOutAction ? (
          <form action={signOutAction} className="flex items-center justify-between gap-2 px-2 py-1">
            <div className="min-w-0 flex-1 truncate text-[12px] text-muted" title={userEmail ?? ''}>
              {userEmail ?? 'Signed in'}
            </div>
            <button
              type="submit"
              className="rounded-sm px-1.5 py-1 text-[11px] text-subtle transition hover:bg-elevated hover:text-fg"
            >
              Sign out
            </button>
          </form>
        ) : (
          <div className="px-2 py-1 text-[12px] text-muted">{userEmail ?? 'Forwarded auth'}</div>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
      {children}
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={[
          'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition',
          active
            ? 'bg-elevated text-fg shadow-soft'
            : 'text-muted hover:bg-surface hover:text-fg',
        ].join(' ')}
      >
        {active ? (
          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-gold" />
        ) : null}
        <Icon name={item.icon} className={active ? 'text-gold' : 'text-subtle group-hover:text-fg'} />
        <span className="tracking-[-0.01em]">{item.label}</span>
      </Link>
    </li>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-gold to-gold-lo text-gold-ink shadow-soft"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3l6 4v6c0 4-2.7 6.7-6 8-3.3-1.3-6-4-6-8V7l6-4z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 12.5l1.8 1.8 3.2-3.4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Dot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${className}`} />;
}

function Icon({ name, className = '' }: { name: NavItem['icon']; className?: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v4h4" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.25" />
          <path d="M2.75 19a6.25 6.25 0 0 1 12.5 0" />
          <path d="M16 11a3 3 0 1 0 0-6" />
          <path d="M21.25 18a5.5 5.5 0 0 0-4.5-5.4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}
