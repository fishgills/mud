'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { resolveBasePath, withBasePath } from '../lib/base-path';

type NavItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/me', label: 'Character', requiresAuth: true },
  { href: '/me/store', label: 'Store', requiresAuth: true },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/support', label: 'Support' },
  { href: '/about', label: 'About' },
];

type TopNavProps = {
  isAuthenticated?: boolean;
};

export default function TopNav({ isAuthenticated = false }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(withBasePath('/api/auth/logout'), {
        method: 'POST',
      });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };
  const basePath = resolveBasePath();
  const normalizedPath =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname;

  const isActive = (href: string) => {
    if (href === '/') {
      return normalizedPath === '/';
    }
    if (href === '/me') {
      return normalizedPath === '/me' || normalizedPath === '/me/inventory';
    }
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
        {navItems
          .filter((item) => !item.requiresAuth || isAuthenticated)
          .map((item) => {
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
        {isAuthenticated && (
          <li>
            <button
              className="top-nav-link"
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{ cursor: isLoggingOut ? 'wait' : 'pointer' }}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
