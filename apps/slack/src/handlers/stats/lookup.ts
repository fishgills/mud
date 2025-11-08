import { getPlayer, getLocationEntities } from '../../dm-client';
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
  const result = await getPlayer(variables);
  if (result.success && result.data) {
    return { player: result.data as PlayerStatsSource };
  }

  return {
    message: (result.message as string | undefined) ?? defaultMessage,
  };
}

export async function fetchPlayerWithLocation(
  userId: string,
  selfMessage: string,
  teamId?: string,
): Promise<PlayerWithLocationResult> {
  const self = await fetchPlayerRecord(
    { slackId: `${teamId}:${userId}` },
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
    playersHere: (location.players as PlayerStatsSource[]) ?? [],
    monstersHere: (location.monsters as MonsterStatsSource[]) ?? [],
  };
}

export async function fetchLocationEntities(variables: {
  x: number;
  y: number;
}) {
  return getLocationEntities(variables) as Promise<{
    players: PlayerStatsSource[];
    monsters: MonsterStatsSource[];
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
