import Link from 'next/link';

export default function InstalledPage() {
  return (
    <div className="layout">
      <div
        className="panel panel-wide"
        style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pixel-h1">⚔ QUEST UNLOCKED</div>
          <p
            style={{
              fontFamily: "'VT323',monospace",
              fontSize: 18,
              color: 'var(--ink-soft)',
            }}
          >
            BattleForge has joined your guild.
          </p>
        </header>

        <div className="dialog-box">
          <p>
            BattleForge has joined your workspace, adventurer! Open Slack and
            send a direct message to{' '}
            <span style={{ color: 'var(--gold)' }}>BattleForge</span> to begin
            your adventure.
          </p>
          <span className="dialog-cursor">▮</span>
        </div>

        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            className="pixel-h3"
            style={{ color: 'var(--accent)', marginBottom: 4 }}
          >
            ▶ FIRST COMMANDS
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {[
              { cmd: 'new', desc: 'Create your character' },
              { cmd: 'raid', desc: 'Enter a dungeon' },
              { cmd: 'attack', desc: 'Fight a monster' },
              { cmd: 'stats', desc: 'View your progress' },
            ].map(({ cmd, desc }) => (
              <div className="stat-field" key={cmd}>
                <span className="pixel-label" style={{ color: 'var(--gold)' }}>
                  {cmd}
                </span>
                <span
                  style={{
                    fontFamily: "'VT323',monospace",
                    fontSize: 16,
                    color: 'var(--ink-soft)',
                  }}
                >
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <a
            className="btn btn-slack"
            href="slack://open"
            aria-label="Open Slack"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="10" y="1.5" width="4" height="9" rx="2" fill="#36C5F0" />
              <rect
                x="13.5"
                y="10"
                width="9"
                height="4"
                rx="2"
                fill="#2EB67D"
              />
              <rect
                x="10"
                y="13.5"
                width="4"
                height="9"
                rx="2"
                fill="#ECB22E"
              />
              <rect x="1.5" y="10" width="9" height="4" rx="2" fill="#E01E5A" />
            </svg>
            OPEN SLACK
          </a>
          <Link
            href="/"
            style={{
              fontFamily: "'Press Start 2P',monospace",
              fontSize: 6,
              color: 'var(--ink-dim)',
              textDecoration: 'none',
            }}
          >
            BACK TO HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
