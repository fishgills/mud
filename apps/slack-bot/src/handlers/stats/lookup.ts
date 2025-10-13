import { dmSdk } from '../../gql-client';
import { toClientId } from '../../utils/clientId';
import type { PlayerStatsSource, MonsterStatsSource } from './types';

export interface PlayerLookupResult {
  player?: PlayerStatsSource;
  message?: string;
}

export interface PlayerWithLocationResult {
  player?: PlayerStatsSource;
  playersHere?: PlayerStatsSource[];
  monstersHere?: MonsterStatsSource[];
  error?: string;
}

export async function fetchPlayerRecord(
  variables: { slackId?: string; clientId?: string; name?: string },
  defaultMessage: string,
): Promise<PlayerLookupResult> {
  const result = await dmSdk.GetPlayer(variables);
  if (result.getPlayer.success && result.getPlayer.data) {
    return { player: result.getPlayer.data as PlayerStatsSource };
  }

  return {
    message: (result.getPlayer.message as string | undefined) ?? defaultMessage,
  };
}

export async function fetchPlayerWithLocation(
  userId: string,
  selfMessage: string,
): Promise<PlayerWithLocationResult> {
  const self = await fetchPlayerRecord(
    { slackId: toClientId(userId) },
    selfMessage,
  );
  if (!self.player) {
    return { error: self.message ?? selfMessage };
  }

  const location = await fetchLocationEntities({
    x: self.player.x ?? 0,
    y: self.player.y ?? 0,
  });

  return {
    player: self.player,
    playersHere: location.getPlayersAtLocation ?? [],
    monstersHere: location.getMonstersAtLocation ?? [],
  };
}

export async function fetchLocationEntities(variables: {
  x: number;
  y: number;
}) {
  return dmSdk.GetLocationEntities(variables) as Promise<{
    getPlayersAtLocation: PlayerStatsSource[];
    getMonstersAtLocation: MonsterStatsSource[];
  }>;
}

export function findNearbyMatches(
  name: string,
  players: PlayerStatsSource[] = [],
  monsters: MonsterStatsSource[] = [],
) {
  const matchingPlayers = players.filter((player) =>
    namesMatch(player.name, name),
  );
  const matchingMonsters = monsters.filter((monster) =>
    namesMatch(monster.name, name),
  );

  return {
    matchingPlayers,
    matchingMonsters,
    totalMatches: matchingPlayers.length + matchingMonsters.length,
  };
}

function namesMatch(a: string | null | undefined, b: string): boolean {
  if (!a) {
    return false;
  }
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
