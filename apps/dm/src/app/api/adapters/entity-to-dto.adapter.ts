import { PlayerEntity, MonsterEntity } from '@mud/engine';
import type { Player } from '../dto/player.dto';
import type { Monster } from '../dto/monster.dto';

type PlayerLike =
  | PlayerEntity
  | Player
  | (Partial<Player> & Record<string, unknown>);
type MonsterLike = MonsterEntity | (Partial<Monster> & Record<string, unknown>);

const KNOWN_CLIENT_TYPES = new Set(['slack', 'discord', 'web']);

const isClientType = (value: unknown): value is string => {
  return typeof value === 'string' && KNOWN_CLIENT_TYPES.has(value);
};

const parseClientIdentifier = (
  value: string | undefined,
): { type?: string; id?: string } => {
  if (!value) {
    return {};
  }

  const segments = value
    .split(':')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return {};
  }

  if (segments.length === 1) {
    return { id: segments[0] };
  }

  return {
    type: segments[0],
    id: segments[segments.length - 1],
  };
};

const normalizeSlackId = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  let raw = value.trim();
  const prefix = 'slack:';
  while (raw.startsWith(prefix)) {
    raw = raw.slice(prefix.length);
  }

  return raw.length > 0 ? raw : undefined;
};

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

  const parsedClient = parseClientIdentifier(rawClientId);
  if (parsedClient.id) {
    platformId = parsedClient.id;
  }
  if (!clientType && parsedClient.type && isClientType(parsedClient.type)) {
    clientType = parsedClient.type;
  }

  const normalizedSlackId = normalizeSlackId(rawSlackId);

  if (!platformId && normalizedSlackId) {
    platformId = normalizedSlackId;
  }

  if (!clientType) {
    clientType = normalizedSlackId ? 'slack' : 'web';
  }

  if (!platformId) {
    platformId = 'unknown';
  }

  const slackId =
    clientType === 'slack'
      ? (normalizedSlackId ?? platformId)
      : (normalizedSlackId ?? null);

  return {
    clientType,
    clientId: platformId,
    slackId,
  };
};

export class EntityToDtoAdapter {
  /**
   * Convert PlayerEntity to a serializable DTO
   */
  static playerEntityToDto(entity: PlayerLike): Player {
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

    const lastAction = toDateOrUndefined(raw.lastAction);
    const createdAt = toDateOrUndefined(raw.createdAt);
    const updatedAt = toDateOrUndefined(raw.updatedAt) ?? new Date();

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
      createdAt,
      updatedAt,
      worldTileId,
    };
  }

  /**
   * Convert MonsterEntity to a serializable DTO
   */
  static monsterEntityToDto(entity: MonsterLike): Monster {
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

    const lastMove = toDateOrUndefined(raw.lastMove) ?? new Date(0);
    const spawnedAt = toDateOrUndefined(raw.spawnedAt) ?? new Date(0);
    const createdAt = toDateOrUndefined(raw.createdAt) ?? spawnedAt;
    const updatedAt = toDateOrUndefined(raw.updatedAt) ?? new Date();
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
   * Convert array of PlayerEntity to DTOs
   */
  static playerEntitiesToDto(entities: PlayerLike[] = []): Player[] {
    return entities.map((entity) => this.playerEntityToDto(entity));
  }

  /**
   * Convert array of MonsterEntity to DTOs
   */
  static monsterEntitiesToDto(entities: MonsterLike[] = []): Monster[] {
    return entities.map((entity) => this.monsterEntityToDto(entity));
  }
}
