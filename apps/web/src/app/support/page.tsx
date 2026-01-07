export const metadata = {
  title: 'Support',
};

export default function SupportPage() {
  return (
    <div className="page-shell">
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Support
          </h1>
        </header>

        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>
            If you have questions, issues, or would like your data deleted,
            please contact us.
          </p>
        </section>

        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>
            Email:{' '}
            <a className="link-ink" href="mailto:support@battleforge.app">
              support@battleforge.app
            </a>
          </p>
          <p>We typically respond within a few days.</p>
        </section>
      </main>
    </div>
  );
}
