import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">BattleForge</h1>
          <p className="text-base text-zinc-700">
            BattleForge is a multiplayer text adventure game designed to be
            played directly inside Slack through private messages.
          </p>
        </header>
        <section className="text-base leading-7 text-zinc-700">
          <p>
            BattleForge runs entirely in Slack. Players interact with the game
            through direct messages, and the app responds with the results of
            their commands and game progress.
          </p>
        </section>
        <nav className="flex flex-col gap-2 text-base">
          <Link className="text-zinc-900 underline" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="text-zinc-900 underline" href="/support">
            Support
          </Link>
          <Link className="text-zinc-900 underline" href="/about">
            About
          </Link>
        </nav>
      </main>
    </div>
  );
}
