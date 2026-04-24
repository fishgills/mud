export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="layout">
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="pixel-h2">PRIVACY POLICY</div>
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>
        <div className="page-text">
          <h2>1. WHAT DATA WE COLLECT</h2>
          <p>Slack user ID</p>
          <p>Slack workspace ID</p>
          <p>Game-related state (character, stats, progress)</p>

          <h2>2. WHAT WE DO NOT COLLECT</h2>
          <p>Email addresses</p>
          <p>Private Slack messages outside of gameplay commands</p>
          <p>Message history beyond what is needed to process a command</p>

          <h2>3. HOW MESSAGES ARE USED</h2>
          <p>
            Messages are processed only when users interact with the app in DMs.
            Message content is not stored long-term.
          </p>

          <h2>4. DATA RETENTION</h2>
          <p>
            Game state is retained until the user deletes their character or
            removes the app.
          </p>

          <h2>5. DATA DELETION</h2>
          <p>
            Users can delete their data by using the in-game delete character
            command or by emailing support.
          </p>

          <h2>6. CONTACT</h2>
          <p>
            Support email:{' '}
            <a style={{ color: 'var(--accent)', textDecoration: 'underline' }} href="mailto:support@battleforge.app">
              support@battleforge.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
