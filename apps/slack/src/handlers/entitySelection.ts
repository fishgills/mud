/**
 * Shared helpers for building Slack selection options for nearby entities.
 */

export type NearbyPlayer = {
  userId?: string;
  teamId?: string;
  name: string;
};

export type NearbyMonster = {
  id?: string;
  name: string;
};

export const PLAYER_SELECTION_PREFIX = 'P:';

export function encodePlayerSelection(teamId: string, userId: string): string {
  return `${PLAYER_SELECTION_PREFIX}${teamId}:${userId}`;
}

export function decodePlayerSelection(
  value: string,
): { teamId: string; userId: string } | null {
  if (!value.startsWith(PLAYER_SELECTION_PREFIX)) {
    return null;
  }
  const rest = value.slice(PLAYER_SELECTION_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length === 2) {
    const [teamId, userId] = parts;
    if (teamId && userId) {
      return { teamId, userId };
    }
  } else if (parts.length === 1 && parts[0]) {
    // Backwards compatibility: values that only contained userId
    return { teamId: '', userId: parts[0] };
  }
  return null;
}

export type SlackOption = {
  text: {
    type: 'plain_text';
    text: string;
    emoji: true;
  };
  value: string;
};

export function buildPlayerOption(player: NearbyPlayer): SlackOption | null {
  const userId = typeof player.userId === 'string' ? player.userId : null;
  const teamId = typeof player.teamId === 'string' ? player.teamId : null;
  if (!userId) {
    return null;
  }
  if (!teamId) {
    return null;
  }

  const name = player.name ?? 'Unknown Adventurer';
  return {
    text: {
      type: 'plain_text',
      text: `Player: ${name}`,
      emoji: true,
    },
    value: encodePlayerSelection(teamId, userId),
  } as const;
}

export function buildMonsterOption(monster: NearbyMonster): SlackOption | null {
  const id = monster.id;
  if (id === undefined || id === null) {
    return null;
  }
  const value = String(id);
  const name = monster.name ?? 'Unknown Monster';
  return {
    text: {
      type: 'plain_text',
      text: `Monster: ${name}`,
      emoji: true,
    },
    value: `M:${value}`,
  } as const;
}
