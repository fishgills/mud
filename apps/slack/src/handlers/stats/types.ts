import type { Player, Monster } from '@mud/database';

// PlayerStatsSource extends Player with optional slackUser relation
// for Slack-specific operations like determining if viewing own stats
export type PlayerStatsSource = Player & {
  slackUser?: { id: number; teamId: string; userId: string } | null;
};

// Use Prisma types directly - MonsterStatsSource is now just an alias to Monster
export type MonsterStatsSource = Monster;
