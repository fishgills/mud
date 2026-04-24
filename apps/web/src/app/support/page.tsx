export const metadata = {
  title: 'Support',
};

export default function SupportPage() {
  return (
    <div className="layout">
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="pixel-h2">SUPPORT</div>
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>
        <div className="page-text">
          <p>
            If you have questions, issues, or would like your data deleted, please
            contact us.
          </p>
          <p>
            Email:{' '}
            <a style={{ color: 'var(--accent)', textDecoration: 'underline' }} href="mailto:support@battleforge.app">
              support@battleforge.app
            </a>
          </p>
          <p>We typically respond within a few days.</p>
        </div>
      </div>
    </div>
  );
}
