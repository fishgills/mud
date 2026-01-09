export default function Home() {
  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="title-font text-4xl font-semibold tracking-tight">
          BattleForge
        </h1>
        <p className="text-base text-[color:var(--ink-soft)]">
          BattleForge is a multiplayer text adventure game designed to be played
          directly inside Slack through private messages.
        </p>
      </header>
      <div className="section-divider" aria-hidden="true">
        <svg
          className="divider-icon"
          viewBox="0 0 24 24"
          role="img"
          aria-label="Crossed blades"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 4l4 4" />
          <path d="M4 5l3 3" />
          <path d="M9 9l-2 2" />
          <path d="M19 4l-4 4" />
          <path d="M20 5l-3 3" />
          <path d="M15 9l2 2" />
          <path d="M7 13l10 6" />
          <path d="M17 13l-10 6" />
        </svg>
      </div>
      <section className="text-base leading-7 text-[color:var(--ink-soft)]">
        <p>
          BattleForge runs entirely in Slack. Players interact with the game
          through direct messages, and the app responds with the results of
          their commands and game progress.
        </p>
      </section>
    </main>
  );
}
