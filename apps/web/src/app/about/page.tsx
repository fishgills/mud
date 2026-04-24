export const metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="layout">
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="pixel-h2">ABOUT BATTLEFORGE</div>
        <div className="divider">
          <div className="divider-line" />
          <span className="divider-glyph">⚔</span>
          <div className="divider-line" />
        </div>
        <div className="page-text">
          <p>BattleForge is a multiplayer text adventure RPG built to live entirely inside Slack DMs. No downloads, no launchers — just type a command and enter the dungeon.</p>
          <h2>HOW IT WORKS</h2>
          <p>Add the bot to your Slack workspace. Send <span style={{ color: 'var(--gold)' }}>new</span> to create your character. Then use <span style={{ color: 'var(--gold)' }}>raid</span> to enter a dungeon, <span style={{ color: 'var(--gold)' }}>attack</span> to fight, and <span style={{ color: 'var(--gold)' }}>stats</span> to view your progress.</p>
          <h2>THE WEB APP</h2>
          <p>This companion app lets you manage your inventory, browse the guild store, and view your character sheet. All game actions still happen in Slack.</p>
          <h2>BUILT BY</h2>
          <p>A small team of adventurers who wanted to play dungeon games without leaving their work tools.</p>
        </div>
      </div>
    </div>
  );
}
