import type { LocationEntities, Player } from '@mud/api-contracts';

export type PlayerStatsSource = Player;

export type MonsterStatsSource = LocationEntities['monsters'][number];
