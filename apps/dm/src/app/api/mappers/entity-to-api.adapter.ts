/**
 * Adapter helpers to convert engine entities into API contract shapes.
 */

import { PlayerEntity, MonsterEntity } from '@mud/engine';
import type {
  Player,
  Monster,
} from '@mud/api-contracts';

type PlayerLike = PlayerEntity | (Partial<Player> & Record<string, unknown>);
type MonsterLike =
  | MonsterEntity
  | (Partial<Monster> & Record<string, unknown>);

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
};

const toDateOrUndefined = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
};

const toIsoOrNull = (value: unknown): string | null => {
  const date = toDateOrUndefined(value);
  return date ? date.toISOString() : null;
};

const toStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return undefined;
};

const resolveClientIdentity = (
  entity: Record<string, unknown>,
): {
  clientType: string;
  clientId: string;
  slackId: string | null;
} => {
  const rawClientId = toStringOrUndefined(entity.clientId);
  const rawClientType = toStringOrUndefined(entity.clientType);
  const rawSlackId = toStringOrUndefined(entity.slackId);

  let clientType = rawClientType;
  let platformId = rawClientId;

  if (rawClientId && rawClientId.includes(':')) {
    const [maybeType, maybeId] = rawClientId.split(':', 2);
    if (maybeId) {
      platformId = maybeId;
      if (!clientType) {
        clientType = maybeType;
      }
    }
  }

  if (!platformId && rawSlackId) {
    platformId = rawSlackId;
    if (!clientType) {
      clientType = 'slack';
    }
  }

  if (!clientType) {
    clientType = 'web';
  }

  if (!platformId) {
    platformId = 'unknown';
  }

  const slackId = clientType === 'slack' ? platformId : rawSlackId ?? null;

  return {
    clientType,
    clientId: platformId,
    slackId,
  };
};

export class EntityToApiAdapter {
  /**
   * Convert PlayerEntity to API Player model
   */
  static playerEntityToApi(entity: PlayerLike): Player {
    const raw = entity as Record<string, unknown>;
    const position =
      (raw.position as Record<string, unknown> | undefined) ?? {};
    const combat = (raw.combat as Record<string, unknown> | undefined) ?? {};
    const attributes =
      (raw.attributes as Record<string, unknown> | undefined) ?? {};

    const { clientType, clientId, slackId } = resolveClientIdentity(raw);

    const hp = toNumber(combat.hp ?? raw.hp, 0);
    const maxHp = toNumber(
      combat.maxHp ?? raw.maxHp ?? combat.hp ?? raw.hp,
      hp,
    );

    const lastAction = toIsoOrNull(raw.lastAction);
    const createdAt = toIsoOrNull(raw.createdAt);
    const updatedAt = toIsoOrNull(raw.updatedAt) ?? new Date().toISOString();

    const worldTileRaw = raw.worldTileId;
    const worldTileId =
      worldTileRaw === null || worldTileRaw === undefined
        ? null
        : toNumber(worldTileRaw);

    return {
      id: toNumber(raw.id, 0),
      clientId: `${clientType}:${clientId}`,
      clientType,
      slackId,
      name: toStringOrUndefined(raw.name) ?? 'Unknown Adventurer',
      x: toNumber(position.x ?? raw.x, 0),
      y: toNumber(position.y ?? raw.y, 0),
      hp,
      maxHp,
      strength: toNumber(attributes.strength ?? raw.strength, 0),
      agility: toNumber(attributes.agility ?? raw.agility, 0),
      health: toNumber(attributes.health ?? raw.health, 0),
      gold: toNumber(raw.gold, 0),
      xp: toNumber(raw.xp, 0),
      level: toNumber(raw.level, 1),
      skillPoints: toNumber(raw.skillPoints, 0),
      isAlive: toBoolean(
        combat.isAlive ?? raw.isAlive,
        hp > 0 || toBoolean(raw.isAlive, true),
      ),
      lastAction,
      createdAt: createdAt ?? null,
      updatedAt,
      worldTileId,
      currentTile: null,
      nearbyPlayers: [],
      nearbyMonsters: [],
    };
  }

  /**
   * Convert MonsterEntity to API Monster model
   */
  static monsterEntityToApi(entity: MonsterLike): Monster {
    const raw = entity as Record<string, unknown>;
    const position =
      (raw.position as Record<string, unknown> | undefined) ?? {};
    const combat = (raw.combat as Record<string, unknown> | undefined) ?? {};
    const attributes =
      (raw.attributes as Record<string, unknown> | undefined) ?? {};

    const hp = toNumber(combat.hp ?? raw.hp, 0);
    const maxHp = toNumber(
      combat.maxHp ?? raw.maxHp ?? combat.hp ?? raw.hp,
      hp,
    );

    const lastMove = toIsoOrNull(raw.lastMove) ?? new Date(0).toISOString();
    const spawnedAt = toIsoOrNull(raw.spawnedAt) ?? new Date(0).toISOString();
    const createdAt = toIsoOrNull(raw.createdAt) ?? spawnedAt;
    const updatedAt = toIsoOrNull(raw.updatedAt) ?? new Date().toISOString();
    const worldTileRaw = raw.worldTileId;
    const worldTileId =
      worldTileRaw === null || worldTileRaw === undefined
        ? undefined
        : toNumber(worldTileRaw);

    return {
      id: toNumber(raw.id, 0),
      name: toStringOrUndefined(raw.name) ?? 'Unknown Monster',
      type: toStringOrUndefined(raw.type) ?? 'unknown',
      hp,
      maxHp,
      strength: toNumber(attributes.strength ?? raw.strength, 0),
      agility: toNumber(attributes.agility ?? raw.agility, 0),
      health: toNumber(attributes.health ?? raw.health, 0),
      x: toNumber(position.x ?? raw.x, 0),
      y: toNumber(position.y ?? raw.y, 0),
      isAlive: toBoolean(
        combat.isAlive ?? raw.isAlive,
        hp > 0 || toBoolean(raw.isAlive, true),
      ),
      lastMove,
      spawnedAt,
      biomeId: toNumber(raw.biomeId, 0),
      worldTileId,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Convert array of PlayerEntity to API Player models
   */
  static playerEntitiesToApi(entities: PlayerLike[] = []): Player[] {
    return entities.map((entity) => this.playerEntityToApi(entity));
  }

  /**
   * Convert array of MonsterEntity to API Monster models
   */
  static monsterEntitiesToApi(entities: MonsterLike[] = []): Monster[] {
    return entities.map((entity) => this.monsterEntityToApi(entity));
  }
}
