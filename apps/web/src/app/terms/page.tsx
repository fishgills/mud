export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          Terms of Service
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

      <section className="text-base leading-7 text-[color:var(--ink-soft)]">
        <p>
          BattleForge is provided as-is for entertainment and experimentation in
          Slack. By using the app, you agree to use it respectfully and avoid
          abuse, automation, or attempts to disrupt service.
        </p>
        <p>
          The game may change or be unavailable at any time. If you need
          assistance or wish to stop using the app, contact support.
        </p>
      </section>
    </main>
  );
}
