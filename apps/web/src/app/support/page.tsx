export const metadata = {
  title: 'Support',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
        </header>

        <section className="text-base leading-7 text-zinc-700">
          <p>
            If you have questions, issues, or would like your data deleted,
            please contact us.
          </p>
        </section>

        <section className="text-base leading-7 text-zinc-700">
          <p>
            Email:{' '}
            <a className="underline" href="mailto:support@battleforge.app">
              support@battleforge.app
            </a>
          </p>
          <p>We typically respond within a few days.</p>
        </section>
      </main>
    </div>
  );
}
