import { getSession } from './lib/slack-auth';

export default async function Home() {
  const session = await getSession();
  return (
    <div className="layout">
      <div className="panel panel-wide" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pixel-h1">⚔ BATTLEFORGE</div>
          <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-soft)' }}>
            A multiplayer dungeon adventure played entirely in Slack DMs.
          </p>
        </header>
        <div className="dialog-box">
          <p>Welcome, adventurer! BattleForge runs entirely in Slack. Send commands like <span style={{ color: 'var(--gold)' }}>raid</span>, <span style={{ color: 'var(--gold)' }}>attack</span>, and <span style={{ color: 'var(--gold)' }}>stats</span> to begin your quest.</p>
          <span className="dialog-cursor">▮</span>
        </div>
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>
        <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Explore procedurally generated dungeons. Fight monsters. Collect legendary loot. Level up your hero — without leaving Slack.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <a
            className="btn btn-slack"
            href="https://slack.com/oauth/v2/authorize?client_id=375846128833.9436068256694&scope=im:history,im:write&user_scope="
            aria-label="Add BattleForge to Slack"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="10" y="1.5" width="4" height="9" rx="2" fill="#36C5F0" />
              <rect x="13.5" y="10" width="9" height="4" rx="2" fill="#2EB67D" />
              <rect x="10" y="13.5" width="4" height="9" rx="2" fill="#ECB22E" />
              <rect x="1.5" y="10" width="9" height="4" rx="2" fill="#E01E5A" />
            </svg>
            ADD TO SLACK
          </a>
          {!session && (
            <a className="btn" href="/api/auth/slack/start">SIGN IN</a>
          )}
        </div>
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>
        <div style={{ border: '2px solid #1c2038', background: '#080a12', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'var(--accent)', letterSpacing: '0.1em' }}>▶ DUNGEON MAP</div>
          <pre style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: '#2a3260', lineHeight: 1.3, letterSpacing: '0.05em', border: '2px solid #1c2038', padding: 12, background: '#080a12' }}>{`┌──────────────────────┐
│  @ · · · G · · │
│  · █ █ · · · │
│  · · · · $ · │
│  · G · █ · · │
│  · · · · · ≡ │
└──────────────────────┘`}</pre>
          <div style={{ fontFamily: "'VT323',monospace", fontSize: 14, color: '#2a3260' }}>@ = hero  G = goblin  $ = loot  ≡ = exit</div>
        </div>
      </div>
    </div>
  );
}
