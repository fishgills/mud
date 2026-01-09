import type { ReactNode } from 'react';
import SideNav from './SideNav';

type PageLayoutProps = {
  children: ReactNode;
};

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-shell">
      <div className="page-layout">
        <SideNav />
        {children}
      </div>
    </div>
  );
}
