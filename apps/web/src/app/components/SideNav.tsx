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
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/support', label: 'Support' },
  { href: '/about', label: 'About' },
];

export default function SideNav() {
  const pathname = usePathname();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const normalizedPath =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname;
  return (
    <nav className="side-nav" aria-label="Site">
      <div className="side-nav-title">BattleForge</div>
      <ul className="side-nav-list">
        {navItems.map((item) => {
          const isActive = item.href === normalizedPath;
          return (
            <li key={item.href}>
              <Link
                className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
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
