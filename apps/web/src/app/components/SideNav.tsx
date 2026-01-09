'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/support', label: 'Support' },
  { href: '/about', label: 'About' },
];

export default function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="side-nav" aria-label="Site">
      <div className="side-nav-title">BattleForge</div>
      <ul className="side-nav-list">
        {navItems.map((item) => {
          const isActive = item.href === pathname;
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
