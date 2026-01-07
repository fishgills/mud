export const metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="page-shell">
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            About
          </h1>
        </header>

        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
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
