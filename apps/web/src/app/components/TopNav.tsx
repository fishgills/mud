'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/me', label: 'Character' },
  { href: '/me/inventory', label: 'Inventory' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/support', label: 'Support' },
  { href: '/about', label: 'About' },
];

export default function TopNav() {
  const pathname = usePathname();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const normalizedPath =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname;

  const isActive = (href: string) => {
    if (href === '/') {
      return normalizedPath === '/';
    }
    // For /me and /me/inventory, match exactly
    return normalizedPath === href;
  };

  return (
    <nav className="top-nav" aria-label="Site">
      <div className="top-nav-brand">
        <Link href="/" className="top-nav-title">
          BattleForge
        </Link>
      </div>
      <ul className="top-nav-list">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                className={`top-nav-link ${active ? 'top-nav-link-active' : ''}`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
