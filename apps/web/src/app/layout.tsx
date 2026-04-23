import type { Metadata } from 'next';
import './globals.css';
import DatadogRum from './components/DatadogRum';
import PageLayout from './components/PageLayout';

export const metadata: Metadata = {
  title: {
    default: 'BattleForge',
    template: 'BattleForge | %s',
  },
  description:
    'BattleForge is a multiplayer text adventure game played in Slack DMs.',
  other: {
    'slack-app-id': 'A09CU207JLE',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DatadogRum />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
