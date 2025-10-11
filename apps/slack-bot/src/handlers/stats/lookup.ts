import type { LocationEntities, Player } from '@mud/api-contracts';
import { dmSdk } from '../../clients/dm-sdk';
import { toClientId } from '../../utils/clientId';

type GetPlayerArgs = Parameters<typeof dmSdk.GetPlayer>[0];
type GetLocationEntitiesArgs = Parameters<typeof dmSdk.GetLocationEntities>[0];

type GetPlayerResult = Awaited<ReturnType<typeof dmSdk.GetPlayer>>;
type PlayerRecord = NonNullable<GetPlayerResult['getPlayer']['data']>;

type GetLocationEntitiesResult = Awaited<
  ReturnType<typeof dmSdk.GetLocationEntities>
>['getLocationEntities'];
type LocationEntitiesData = NonNullable<GetLocationEntitiesResult['data']>;

interface PlayerLookupResult {
  player?: PlayerRecord;
  message?: string;
}

interface PlayerWithLocationResult {
  player?: PlayerRecord;
  playersHere?: LocationEntities['players'];
  monstersHere?: LocationEntities['monsters'];
  error?: string;
}

export async function fetchPlayerRecord(
  variables: GetPlayerArgs,
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
  const self = await fetchPlayerRecord(
    { slackId: toClientId(userId) },
    selfMessage,
  );
  if (!self.player) {
    return { error: self.message ?? selfMessage };
  }

  const location = await fetchLocationEntities({
    x: self.player.x,
    y: self.player.y,
  });
  const data = location.getLocationEntities.data;

  return {
    player: self.player,
    playersHere: data?.players ?? [],
    monstersHere: data?.monsters ?? [],
  };
}

export async function fetchLocationEntities(
  variables: GetLocationEntitiesArgs,
): Promise<{
  getLocationEntities: GetLocationEntitiesResult & {
    data: LocationEntitiesData;
  };
}> {
  const response = await dmSdk.GetLocationEntities(variables);
  const data = response.getLocationEntities.data ?? {
    players: [],
    monsters: [],
  };
  return {
    getLocationEntities: {
      ...response.getLocationEntities,
      data,
    },
  };
}

export function findNearbyMatches(
  name: string,
  players: LocationEntities['players'] = [],
  monsters: LocationEntities['monsters'] = [],
) {
  const normalized = name.trim().toLowerCase();
  const matchingPlayers = players.filter((player) =>
    namesMatch(player.name, normalized),
  );
  const matchingMonsters = monsters.filter((monster) =>
    namesMatch(monster.name, normalized),
  );

  return {
    matchingPlayers,
    matchingMonsters,
    totalMatches: matchingPlayers.length + matchingMonsters.length,
  };
}

function namesMatch(
  value: Player['name'] | null | undefined,
  normalizedTarget: string,
): boolean {
  if (!value) {
    return false;
  }
  return value.trim().toLowerCase() === normalizedTarget;
}
