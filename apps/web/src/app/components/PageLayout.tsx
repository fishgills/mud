import type { ReactNode } from 'react';
import TopNav from './TopNav';

type PageLayoutProps = {
  children: ReactNode;
};

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-shell">
      <TopNav />
      <div className="page-layout">{children}</div>
    </div>
  );
}
