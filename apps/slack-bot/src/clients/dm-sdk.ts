import {
  type CombatResponse,
  type LocationEntitiesResponse,
  type LocationResponse,
  type LookViewResponse,
  type PlayerMoveResponse,
  type PlayerResponse,
  type PlayerStatsResponse,
  type SniffResponse,
} from '@mud/api-contracts';
import { dmClient } from './dm-client';

export enum TargetType {
  Monster = 'monster',
  Player = 'player',
}

export enum PlayerAttribute {
  Strength = 'strength',
  Agility = 'agility',
  Health = 'health',
}

type CreatePlayerVariables = {
  input: {
    slackId?: string | null;
    clientId?: string | null;
    clientType?: 'slack' | 'discord' | 'web' | null;
    name: string;
    x?: number | null;
    y?: number | null;
  };
};

type IdentifierQuery = {
  slackId?: string | null;
  clientId?: string | null;
  name?: string | null;
};

type AttackVariables = {
  slackId?: string | null;
  clientId?: string | null;
  input: {
    targetType: TargetType;
    targetId?: number | null;
    targetSlackId?: string | null;
    ignoreLocation?: boolean | null;
  };
};

type MovePlayerVariables = {
  slackId?: string | null;
  clientId?: string | null;
  input: {
    direction?: string | null;
    distance?: number | null;
    x?: number | null;
    y?: number | null;
  };
};

type SpendSkillPointVariables = {
  slackId?: string | null;
  clientId?: string | null;
  attribute: PlayerAttribute;
};

const normalizeIdentifier = (value?: string | null): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : value;

const unwrap = async <T>(
  promise: Promise<{ status: number; body: T }>,
): Promise<T> => {
  const response = await promise;
  if (response.status >= 400) {
    let message = `DM API request failed with status ${response.status}`;
    const body = response.body as unknown;
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof (body as { message?: unknown }).message === 'string'
    ) {
      const candidate = (body as { message: string }).message.trim();
      if (candidate.length > 0) {
        message = candidate;
      }
    }
    const error = new Error(message);
    (error as { status?: number }).status = response.status;
    (error as { responseBody?: unknown }).responseBody = response.body;
    throw error;
  }
  return response.body;
};

export const dmSdk = {
  async CreatePlayer({ input }: CreatePlayerVariables) {
    const body = await unwrap(
      dmClient.createPlayer({
        body: {
          slackId: normalizeIdentifier(input.slackId),
          clientId: normalizeIdentifier(input.clientId),
          clientType: input.clientType ?? undefined,
          name: input.name,
          x: typeof input.x === 'number' ? input.x : undefined,
          y: typeof input.y === 'number' ? input.y : undefined,
        },
      }),
    );

    return {
      createPlayer: body,
    } satisfies {
      createPlayer: PlayerResponse;
    };
  },

  async GetPlayer(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.getPlayer({
        query: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
          name: normalizeIdentifier(query.name),
        },
      }),
    );

    return {
      getPlayer: body,
    } satisfies {
      getPlayer: PlayerResponse;
    };
  },

  async GetPlayerStats(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.getPlayerStats({
        query: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
          name: normalizeIdentifier(query.name),
        },
      }),
    );

    return {
      getPlayerStats: body,
    } satisfies {
      getPlayerStats: PlayerStatsResponse;
    };
  },

  async MovePlayer(variables: MovePlayerVariables) {
    const body = await unwrap(
      dmClient.movePlayer({
        body: {
          slackId: normalizeIdentifier(variables.slackId),
          clientId: normalizeIdentifier(variables.clientId),
          input: {
            direction: variables.input.direction ?? undefined,
            distance:
              typeof variables.input.distance === 'number'
                ? variables.input.distance
                : undefined,
            x:
              typeof variables.input.x === 'number'
                ? variables.input.x
                : undefined,
            y:
              typeof variables.input.y === 'number'
                ? variables.input.y
                : undefined,
          },
        },
      }),
    );

    return {
      movePlayer: body,
    } satisfies {
      movePlayer: PlayerMoveResponse;
    };
  },

  async Attack(variables: AttackVariables) {
    const body = await unwrap(
      dmClient.attack({
        body: {
          slackId: normalizeIdentifier(variables.slackId),
          clientId: normalizeIdentifier(variables.clientId),
          input: {
            targetType: variables.input.targetType,
            targetId:
              typeof variables.input.targetId === 'number'
                ? variables.input.targetId
                : undefined,
            targetSlackId: normalizeIdentifier(variables.input.targetSlackId),
            ignoreLocation: variables.input.ignoreLocation ?? undefined,
          },
        },
      }),
    );

    return {
      attack: body,
    } satisfies {
      attack: CombatResponse;
    };
  },

  async SniffNearestMonster(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.sniffNearestMonster({
        query: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
        },
      }),
    );

    return {
      sniffNearestMonster: body,
    } satisfies {
      sniffNearestMonster: SniffResponse;
    };
  },

  async SpendSkillPoint(variables: SpendSkillPointVariables) {
    const body = await unwrap(
      dmClient.spendSkillPoint({
        body: {
          slackId: normalizeIdentifier(variables.slackId),
          clientId: normalizeIdentifier(variables.clientId),
          attribute: variables.attribute,
        },
      }),
    );

    return {
      spendSkillPoint: body,
    } satisfies {
      spendSkillPoint: PlayerResponse;
    };
  },

  async RerollPlayerStats(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.rerollPlayerStats({
        body: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
        },
      }),
    );

    return {
      rerollPlayerStats: body,
    } satisfies {
      rerollPlayerStats: PlayerResponse;
    };
  },

  async DeletePlayer(query: { slackId: string }) {
    const body = await unwrap(
      dmClient.deletePlayer({
        query: { slackId: query.slackId },
      }),
    );

    return {
      deletePlayer: body,
    } satisfies {
      deletePlayer: PlayerResponse;
    };
  },

  async GetLocationEntities(query: { x: number; y: number }) {
    const body = await unwrap(dmClient.getLocationEntities({ query }));
    return {
      getLocationEntities: body,
    } satisfies {
      getLocationEntities: LocationEntitiesResponse;
    };
  },

  async GetLookView(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.getLookView({
        query: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
        },
      }),
    );

    return {
      getLookView: body,
    } satisfies {
      getLookView: LookViewResponse;
    };
  },

  async GetPlayerLocationDetails(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.getPlayerLocationDetails({
        query: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
        },
      }),
    );

    return {
      getPlayerLocationDetails: body,
    } satisfies {
      getPlayerLocationDetails: LocationResponse;
    };
  },

  async CompletePlayer(query: IdentifierQuery) {
    const body = await unwrap(
      dmClient.updatePlayerStats({
        body: {
          slackId: normalizeIdentifier(query.slackId),
          clientId: normalizeIdentifier(query.clientId),
          input: { hp: 10 },
        },
      }),
    );

    return {
      updatePlayerStats: body,
    } satisfies {
      updatePlayerStats: PlayerResponse;
    };
  },
};
