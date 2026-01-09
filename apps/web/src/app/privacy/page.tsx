export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
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

      <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
        <h2 className="title-font text-lg font-semibold">
          1. What Data We Collect
        </h2>
        <ul className="list-disc pl-5">
          <li>Slack user ID</li>
          <li>Slack workspace ID</li>
          <li>Game-related state (character, stats, progress)</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
        <h2 className="title-font text-lg font-semibold">
          2. What We Do NOT Collect
        </h2>
        <ul className="list-disc pl-5">
          <li>Email addresses</li>
          <li>Private Slack messages outside of gameplay commands</li>
          <li>Message history beyond what is needed to process a command</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
        <h2 className="title-font text-lg font-semibold">
          3. How Messages Are Used
        </h2>
        <p>
          Messages are processed only when users interact with the app in DMs.
          Message content is not stored long-term.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
        <h2 className="title-font text-lg font-semibold">4. Data Retention</h2>
        <p>
          Game state is retained until the user deletes their character or
          removes the app.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
        <h2 className="title-font text-lg font-semibold">5. Data Deletion</h2>
        <p>
          Users can delete their data by using the in-game delete character
          command or by emailing support.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
        <h2 className="title-font text-lg font-semibold">6. Contact</h2>
        <p>
          Support email:{' '}
          <a className="link-ink" href="mailto:support@battleforge.app">
            support@battleforge.app
          </a>
        </p>
      </section>
    </main>
  );
}
