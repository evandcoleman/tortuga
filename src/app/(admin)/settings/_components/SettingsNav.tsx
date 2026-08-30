'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/settings/general', label: 'General' },
  { href: '/settings/content', label: 'Content' },
  { href: '/settings/email', label: 'Email' },
  { href: '/settings/services', label: 'Services' },
] as const;

export function SettingsNav() {
  const pathname = usePathname() ?? '/settings/general';

  return (
    <nav className="mb-8 flex gap-1 border-b border-line" aria-label="Settings sections">
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'relative px-3.5 py-2.5 text-[13.5px] font-medium tracking-[-0.005em] transition',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {tab.label}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
