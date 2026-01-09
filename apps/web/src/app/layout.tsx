import type { Metadata } from 'next';
import { Cinzel, Crimson_Text } from 'next/font/google';
import './globals.css';
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
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
