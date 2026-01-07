import Link from 'next/link';

export default function Home() {
  return (
    <div className="page-shell">
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="title-font text-4xl font-semibold tracking-tight">
            BattleForge
          </h1>
          <p className="text-base text-[color:var(--ink-soft)]">
            BattleForge is a multiplayer text adventure game designed to be
            played directly inside Slack through private messages.
          </p>
        </header>
        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>
            BattleForge runs entirely in Slack. Players interact with the game
            through direct messages, and the app responds with the results of
            their commands and game progress.
          </p>
        </section>
        <nav className="flex flex-col gap-2 text-base">
          <Link className="link-ink" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="link-ink" href="/support">
            Support
          </Link>
          <Link className="link-ink" href="/about">
            About
          </Link>
        </nav>
      </main>
    </div>
  );
}
