import type { Metadata } from 'next';
import { Cinzel, Crimson_Text } from 'next/font/google';
import './globals.css';
import DatadogRum from './components/DatadogRum';
import PageLayout from './components/PageLayout';

const titleFont = Cinzel({
  variable: '--font-title',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const bodyFont = Crimson_Text({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

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
      <body
        className={`${titleFont.variable} ${bodyFont.variable} antialiased`}
      >
        <DatadogRum />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
