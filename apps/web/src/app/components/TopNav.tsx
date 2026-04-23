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
  { href: '/', label: 'HOME' },
  { href: '/me', label: 'CHARACTER', requiresAuth: true },
  { href: '/me/store', label: 'STORE', requiresAuth: true },
  { href: '/privacy', label: 'PRIVACY' },
  { href: '/terms', label: 'TERMS' },
  { href: '/support', label: 'SUPPORT' },
  { href: '/about', label: 'ABOUT' },
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
    <nav className="nav" aria-label="Site">
      <Link href="/" className="nav-brand">
        ⚔ BATTLEFORGE
      </Link>
      <ul className="nav-list">
        {navItems
          .filter((item) => !item.requiresAuth || isAuthenticated)
          .map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  className={`nav-btn${active ? ' active' : ''}`}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        {isAuthenticated ? (
          <li>
            <button
              className="nav-btn danger"
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{ cursor: isLoggingOut ? 'wait' : 'pointer' }}
            >
              {isLoggingOut ? 'LOGGING OUT...' : 'LOGOUT'}
            </button>
          </li>
        ) : (
          <li>
            <a href="/api/auth/slack/start" className="nav-btn" style={{ color: 'var(--accent)' }}>
              SIGN IN
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
