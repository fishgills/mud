export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
        </header>

        <section className="flex flex-col gap-3 text-base leading-7 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900">
            1. What Data We Collect
          </h2>
          <ul className="list-disc pl-5">
            <li>Slack user ID</li>
            <li>Slack workspace ID</li>
            <li>Game-related state (character, stats, progress)</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900">
            2. What We Do NOT Collect
          </h2>
          <ul className="list-disc pl-5">
            <li>Email addresses</li>
            <li>Private Slack messages outside of gameplay commands</li>
            <li>Message history beyond what is needed to process a command</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900">
            3. How Messages Are Used
          </h2>
          <p>
            Messages are processed only when users interact with the app in DMs.
            Message content is not stored long-term.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900">
            4. Data Retention
          </h2>
          <p>
            Game state is retained until the user deletes their character or
            removes the app.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900">
            5. Data Deletion
          </h2>
          <p>
            Users can delete their data by using the in-game delete character
            command or by emailing support.
          </p>
        </section>

        <section className="flex flex-col gap-3 text-base leading-7 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900">6. Contact</h2>
          <p>
            Support email:{' '}
            <a className="underline" href="mailto:support@battleforge.app">
              support@battleforge.app
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
