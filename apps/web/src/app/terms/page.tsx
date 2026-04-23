export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="layout">
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="pixel-h2">TERMS OF SERVICE</div>
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>
        <div className="page-text">
          <p>
            BattleForge is provided as-is for entertainment and experimentation in
            Slack. By using the app, you agree to use it respectfully and avoid
            abuse, automation, or attempts to disrupt service.
          </p>
          <p>
            The game may change or be unavailable at any time. If you need
            assistance or wish to stop using the app, contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
