import type { ReactNode } from 'react';
import TopNav from './TopNav';
import { getSession } from '../lib/slack-auth';

type PageLayoutProps = {
  children: ReactNode;
};

export default async function PageLayout({ children }: PageLayoutProps) {
  const session = await getSession();

  return (
    <div className="page-shell">
      <TopNav isAuthenticated={!!session} />
      <div className="page-layout">{children}</div>
    </div>
  );
}
