export const metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        </header>

        <section className="text-base leading-7 text-zinc-700">
          <p>
            BattleForge is a multiplayer text adventure game that runs inside
            Slack DMs.
          </p>
          <p>
            It is a hobby project built for fun and experimentation with
            text-based gameplay.
          </p>
        </section>
      </main>
    </div>
  );
}
