import { dmSdk } from '../../gql-client';
import {
  GetLocationEntitiesQuery,
  GetLocationEntitiesQueryVariables,
  GetPlayerQuery,
  GetPlayerQueryVariables,
} from '../../generated/dm-graphql';

interface PlayerLookupResult {
  player?: NonNullable<GetPlayerQuery['getPlayer']['data']>;
  message?: string;
}

interface PlayerWithLocationResult {
  player?: NonNullable<GetPlayerQuery['getPlayer']['data']>;
  playersHere?: GetLocationEntitiesQuery['getPlayersAtLocation'];
  monstersHere?: GetLocationEntitiesQuery['getMonstersAtLocation'];
  error?: string;
}

export async function fetchPlayerRecord(
  variables: GetPlayerQueryVariables,
  defaultMessage: string,
): Promise<PlayerLookupResult> {
  const result = await dmSdk.GetPlayer(variables);
  if (result.getPlayer.success && result.getPlayer.data) {
    return { player: result.getPlayer.data };
  }

  return {
    message: result.getPlayer.message ?? defaultMessage,
  };
}

export async function fetchPlayerWithLocation(
  userId: string,
  selfMessage: string,
): Promise<PlayerWithLocationResult> {
  const self = await fetchPlayerRecord({ slackId: userId }, selfMessage);
  if (!self.player) {
    return { error: self.message ?? selfMessage };
  }

  const location = await fetchLocationEntities({
    x: self.player.x,
    y: self.player.y,
  });

  return {
    player: self.player,
    playersHere: location.getPlayersAtLocation ?? [],
    monstersHere: location.getMonstersAtLocation ?? [],
  };
}

export async function fetchLocationEntities(
  variables: GetLocationEntitiesQueryVariables,
) {
  return dmSdk.GetLocationEntities(variables);
}

export function findNearbyMatches(
  name: string,
  players: GetLocationEntitiesQuery['getPlayersAtLocation'] = [],
  monsters: GetLocationEntitiesQuery['getMonstersAtLocation'] = [],
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
