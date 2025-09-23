import {
  GetLocationEntitiesQuery,
  GetPlayerQuery,
} from '../../generated/dm-graphql';

export type PlayerStatsSource =
  | NonNullable<GetPlayerQuery['getPlayer']['data']>
  | GetLocationEntitiesQuery['getPlayersAtLocation'][number];

export type MonsterStatsSource =
  GetLocationEntitiesQuery['getMonstersAtLocation'][number];
