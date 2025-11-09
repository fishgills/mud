import { MonsterEntity } from '@mud/engine';
import { PlayerSlot } from '@prisma/client';
import type { Player, PlayerEquipment } from '../dto/player.dto';
import type { Monster } from '../dto/monster.dto';

type PlayerLike = Player | (Partial<Player> & Record<string, unknown>);
type MonsterLike = MonsterEntity | (Partial<Monster> & Record<string, unknown>);

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

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const result = toNumber(value, Number.NaN);
  return Number.isNaN(result) ? null : result;
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

    const playerItems =
      (raw.playerItems as Array<Record<string, unknown>> | undefined) ?? [];

    // Build equipment from equipped PlayerItems
    const equipment: PlayerEquipment = {
      head: null,
      chest: null,
      legs: null,
      arms: null,
      weapon: null,
    };

    if (Array.isArray(playerItems)) {
      for (const pi of playerItems) {
        const isEquipped = toBoolean(pi.equipped ?? false, false);
        if (!isEquipped) continue;

        // Determine which slot this playerItem occupies. Prefer the per-player
        // assigned slot (pi.slot) but fall back to the Item's declared slot
        // (pi.item?.slot). For weapons, fall back to 'weapon' when item.type
        // indicates a weapon and no slot is set.
        let slot = toStringOrUndefined(pi.slot);
        const item = pi.item as Record<string, unknown> | undefined;
        const itemSlot = toStringOrUndefined(item?.slot);
        const itemType = toStringOrUndefined(item?.type);
        if (!slot) {
          if (itemSlot) slot = itemSlot;
          else if (itemType === 'weapon') slot = PlayerSlot.weapon;
        }

        const itemId = toNumberOrNull(pi.itemId);
        const quality = toStringOrUndefined(pi.quality) ?? 'Common';
        if (!slot || itemId === null) continue;

        const equipmentEntry = { id: itemId, quality };
        if (slot === PlayerSlot.head) equipment.head = equipmentEntry;
        else if (slot === PlayerSlot.chest) equipment.chest = equipmentEntry;
        else if (slot === PlayerSlot.legs) equipment.legs = equipmentEntry;
        else if (slot === PlayerSlot.arms) equipment.arms = equipmentEntry;
        else if (slot === PlayerSlot.weapon) equipment.weapon = equipmentEntry;
      }
    }

    return {
      id: toNumber(raw.id, 0),
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
      isCreationComplete: toBoolean(raw.isCreationComplete, false),
      lastAction,
      createdAt,
      updatedAt,
      worldTileId,
      equipment,
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
