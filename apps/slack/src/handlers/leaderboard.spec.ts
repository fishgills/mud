import type { PlayerRecord } from '../dm-client';
import { formatLeaderboardLines } from './leaderboard';

const makePlayer = (overrides: Partial<PlayerRecord> = {}): PlayerRecord =>
  ({
    name: 'Hero',
    level: 10,
    ...overrides,
  }) as PlayerRecord;

describe('formatLeaderboardLines', () => {
  it('formats medal style with medals and numbered fallback ranks', () => {
    const lines = formatLeaderboardLines(
      [
        makePlayer({ name: 'Ari', level: 10 }),
        makePlayer({ name: 'Bryn', level: 9 }),
        makePlayer({ name: 'Cato', level: 8 }),
        makePlayer({ name: 'Dara', level: 7 }),
      ],
      { emptyLabel: 'No heroes yet', style: 'medal' },
    );

    expect(lines).toBe(
      [
        '🥇 *Ari* - Level 10',
        '🥈 *Bryn* - Level 9',
        '🥉 *Cato* - Level 8',
        '4. *Dara* - Level 7',
      ].join('\n'),
    );
  });

  it('formats rank style with explicit level text', () => {
    const lines = formatLeaderboardLines(
      [
        makePlayer({ name: 'Ari', level: 10 }),
        makePlayer({ name: 'Bryn', level: 9 }),
      ],
      { emptyLabel: 'No heroes yet', style: 'rank' },
    );

    expect(lines).toBe('*1.* Ari - Level 10\n*2.* Bryn - Level 9');
  });

  it('returns italicized empty labels for empty or missing players', () => {
    const emptyListLines = formatLeaderboardLines([], {
      emptyLabel: 'No heroes yet',
      style: 'rank',
    });
    const missingListLines = formatLeaderboardLines(undefined, {
      emptyLabel: 'No legends recorded yet',
      style: 'medal',
    });

    expect(emptyListLines).toBe('_No heroes yet_');
    expect(missingListLines).toBe('_No legends recorded yet_');
  });

  it('falls back to Unknown name and dash level when values are missing', () => {
    const lines = formatLeaderboardLines(
      [makePlayer({ name: undefined, level: undefined })],
      { emptyLabel: 'No heroes yet', style: 'rank' },
    );

    expect(lines).toBe('*1.* Unknown - Level -');
  });
});
