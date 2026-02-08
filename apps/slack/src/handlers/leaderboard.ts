import type { PlayerRecord } from '../dm-client';

type LeaderboardLineStyle = 'rank' | 'medal';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

export const formatLeaderboardLines = (
  players: PlayerRecord[] | undefined,
  options: { emptyLabel: string; style: LeaderboardLineStyle },
): string => {
  if (!players || players.length === 0) {
    return `_${options.emptyLabel}_`;
  }

  return players
    .map((player, index) => {
      const name = player.name ?? 'Unknown';
      const level = player.level ?? '-';
      if (options.style === 'medal') {
        const medal = MEDALS[index] ?? `${index + 1}.`;
        return `${medal} *${name}* - L${level}`;
      }
      return `*${index + 1}.* ${name} - L${level}`;
    })
    .join('\n');
};
