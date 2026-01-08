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
          <p className="text-base leading-7 text-[color:var(--ink-soft)]">
            BattleForge is a multiplayer text adventure game designed to be
            played inside Slack. This Privacy Policy explains what data the
            BattleForge app collects, how it is used, and how users can request
            deletion of their data.
          </p>
        </header>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">
            1. What Data We Collect
          </h2>
          <ul className="list-disc pl-5">
            <li>Slack user ID</li>
            <li>Slack workspace ID</li>
            <li>
              Game-related state (such as character information, stats,
              progress, and inventory)
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">
            2. What We Do NOT Collect
          </h2>
          <ul className="list-disc pl-5">
            <li>Email addresses</li>
            <li>Slack profile details beyond basic identifiers</li>
            <li>
              Private Slack messages outside of user-initiated gameplay commands
            </li>
            <li>
              Message history beyond what is transiently processed to execute a
              command
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">
            3. How Messages Are Used
          </h2>
          <p>
            Messages are processed only when users intentionally interact with
            the app via direct messages. Message content is used transiently to
            execute gameplay commands and is not stored as message history.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">
            4. Data Retention
          </h2>
          <p>
            Game-related data is retained only as long as necessary to support
            gameplay. Data remains stored until a user deletes their character
            or removes the app from their Slack workspace.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">5. Data Sharing</h2>
          <p>
            BattleForge does not sell, rent, or share user data with third
            parties.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">6. Data Deletion</h2>
          <p>
            Users may delete their game data at any time by using the in-game
            character deletion command or by contacting support.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-[color:var(--ink-soft)]">
          <h2 className="title-font text-lg font-semibold">7. Contact</h2>
          <p>
            For questions, support requests, or data deletion inquiries, please
            contact:
            <br />
            <a className="link-ink" href="mailto:support@battleforge.app">
              support@battleforge.app
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
