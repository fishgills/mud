export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
        </header>

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
          <h2 className="title-font text-lg font-semibold">
            4. Data Retention
          </h2>
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
    </div>
  );
}
