/**
 * Player Factory - Creates and manages player entities
 * Inspired by RanvierMUD's factory pattern
 */

import { getPrismaClient, Player } from '@mud/database';

import { PlayerEntity, ClientType } from '../entities/player-entity.js';
import { EventBus } from '../events/index.js';

export interface CreatePlayerOptions {
  clientId: string;
  clientType: ClientType;
  name: string;
  x?: number;
  y?: number;
}

const KNOWN_CLIENT_TYPES: readonly ClientType[] = [
  'slack',
  'discord',
  'web',
] as const;

const isClientType = (value: unknown): value is ClientType => {
  if (typeof value !== 'string') {
    return false;
  }
  return (KNOWN_CLIENT_TYPES as readonly string[]).includes(value);
};

const parseClientIdentifier = (
  raw: string | null | undefined,
): { type?: ClientType; id?: string; legacyId?: string } => {
  if (!raw) {
    return {};
  }

  const segments = raw
    .split(':')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return {};
  }

  const legacyId = segments[segments.length - 1];

  if (segments.length === 1) {
    return { id: segments[0], legacyId };
  }

  const potentialType = segments[0];
  const type = isClientType(potentialType) ? potentialType : undefined;
  const idSegments = type ? segments.slice(1) : segments;

  return {
    type,
    id: idSegments.join(':') || undefined,
    legacyId,
  };
};

const normalizeClientIdentifier = (
  raw: string | null | undefined,
  fallbackType: ClientType,
): { id: string; type: ClientType; legacyId?: string } => {
  const parsed = parseClientIdentifier(raw);
  const type = parsed.type ?? fallbackType;
  let id = (parsed.id ?? raw ?? '').trim();

  if (!id && raw) {
    id = raw.trim();
  }

  return { id, type, legacyId: parsed.legacyId };
};

const normalizeSlackId = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  let raw = value.trim();
  const prefix = 'slack:';
  while (raw.startsWith(prefix)) {
    raw = raw.slice(prefix.length);
  }

  return raw;
};

const buildClientIdVariants = (
  raw: string,
  clientType: ClientType,
): {
  clientIdVariants: Set<string>;
  canonicalId: string;
  canonicalType: ClientType;
  userId?: string;
} => {
  const {
    id: canonicalId,
    type: canonicalType,
    legacyId,
  } = normalizeClientIdentifier(raw, clientType);

  const clientIdVariants = new Set<string>([
    `${canonicalType}:${canonicalId}`,
    raw,
    `${canonicalType}:${raw}`,
    canonicalId,
    `${canonicalType}:${canonicalType}:${canonicalId}`,
  ]);

  if (raw.includes(':')) {
    const segments = raw
      .split(':')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    for (let i = 1; i < segments.length; i += 1) {
      const tail = segments.slice(i).join(':');
      clientIdVariants.add(tail);
      clientIdVariants.add(`${canonicalType}:${tail}`);
    }
  }

  const canonicalSegments = canonicalId
    .split(':')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const userId = canonicalSegments[canonicalSegments.length - 1] ?? legacyId;

  if (userId && userId.length > 0) {
    clientIdVariants.add(`${canonicalType}:${userId}`);
    clientIdVariants.add(userId);
  }

  return { clientIdVariants, canonicalId, canonicalType, userId };
};

export class PlayerFactory {
  private static prisma = getPrismaClient();

  /**
   * Create a new player in the database and return a PlayerEntity
   */
  static async create(options: CreatePlayerOptions): Promise<PlayerEntity> {
    const { clientId, clientType, name, x, y } = options;

    const { id: canonicalClientId, type: canonicalClientType } =
      normalizeClientIdentifier(clientId, clientType);

    // Generate random starting stats
    const stats = this.generateRandomStats();

    // Format clientId with type prefix
    const fullClientId = `${canonicalClientType}:${canonicalClientId}`;

    const player = await this.prisma.player.create({
      data: {
        clientId: fullClientId, // "slack:U123" or "discord:456"
        clientType: canonicalClientType, // "slack", "discord", "web"
        name,
        x: x ?? 0,
        y: y ?? 0,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        strength: stats.strength,
        agility: stats.agility,
        health: stats.health,
        level: 1,
        skillPoints: 0,
        gold: 0,
        xp: 0,
        isAlive: true,
      },
    });

    const entity = this.fromDatabaseModel(player, canonicalClientType);

    // Emit spawn event
    await EventBus.emit({
      eventType: 'player:spawn',
      player,
      x: player.x,
      y: player.y,
      timestamp: new Date(),
    });

    return entity;
  }

  /**
   * Load a player from the database by clientId
   * Supports both new format ("slack:U123") and legacy format ("U123")
   */
  static async load(
    clientId: string,
    clientType: ClientType,
  ): Promise<PlayerEntity | null> {
    const { clientIdVariants, canonicalType, userId } = buildClientIdVariants(
      clientId,
      clientType,
    );

    const orClauses: Array<
      { clientId: string } | { clientId: { endsWith: string } }
    > = [];
    clientIdVariants.forEach((id) => {
      orClauses.push({ clientId: id });
    });
    if (canonicalType === 'slack' && userId && userId.length > 0) {
      // Support workspace-qualified IDs like slack:T123:U999 via legacy userId
      orClauses.push({ clientId: { endsWith: `:${userId}` } });
    }

    const player = await this.prisma.player.findFirst({
      where: {
        OR: orClauses,
      },
      include: { playerItems: { include: { item: true } } },
    });

    if (!player) {
      return null;
    }

    return this.fromDatabaseModel(player, canonicalType);
  }

  /**
   * Load a player from the database by name
   * Returns null if no match, or throws error if multiple matches
   */
  static async loadByName(name: string): Promise<PlayerEntity | null> {
    const matches = await this.prisma.player.findMany({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      orderBy: { id: 'asc' },
      include: { playerItems: { include: { item: true } } },
    });

    if (matches.length === 0) {
      return null;
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple players found with the name "${name}". IDs: ${matches.map((p) => p.id).join(', ')}`,
      );
    }

    const player = matches[0];
    const clientType = (player.clientType || 'slack') as ClientType;
    return this.fromDatabaseModel(player, clientType);
  }

  /**
   * Load all players from the database
   */
  static async loadAll(): Promise<PlayerEntity[]> {
    const players = await this.prisma.player.findMany();
    return players.map((p) => {
      const clientType = (p.clientType || 'slack') as ClientType;
      return this.fromDatabaseModel(p, clientType);
    });
  }

  /**
   * Load players at a specific location
   */
  static async loadAtLocation(
    x: number,
    y: number,
    options?: { excludePlayerId?: number; aliveOnly?: boolean },
  ): Promise<PlayerEntity[]> {
    const players = await this.prisma.player.findMany({
      where: {
        x,
        y,
        ...(options?.aliveOnly ? { isAlive: true } : {}),
        ...(options?.excludePlayerId
          ? { id: { not: options.excludePlayerId } }
          : {}),
      },
      include: { playerItems: { include: { item: true } } },
    });
    return players.map((p) => {
      const clientType = (p.clientType || 'slack') as ClientType;
      return this.fromDatabaseModel(p, clientType);
    });
  }

  /**
   * Load nearby players within a radius
   */
  static async loadNearby(
    x: number,
    y: number,
    options?: {
      radius?: number;
      limit?: number;
      excludeSlackId?: string;
      aliveOnly?: boolean;
    },
  ): Promise<
    Array<{
      player: PlayerEntity;
      distance: number;
      direction: string;
    }>
  > {
    const radius = options?.radius ?? Infinity;
    const limit = options?.limit ?? 10;
    const aliveOnly = options?.aliveOnly ?? true;

    // Build where clause
    const whereClause: {
      isAlive?: boolean;
      AND?: Array<Record<string, unknown>>;
      x?: { gte: number; lte: number };
      y?: { gte: number; lte: number };
    } = {};

    if (aliveOnly) {
      whereClause.isAlive = true;
    }

    if (options?.excludeSlackId) {
      const normalizedExclude = normalizeSlackId(options.excludeSlackId);
      const variants = new Set<string>();
      if (normalizedExclude) {
        variants.add(normalizedExclude);
        variants.add(`slack:${normalizedExclude}`);
      }
      variants.add(options.excludeSlackId);

      const nots: Array<Record<string, unknown>> = Array.from(variants).map(
        (v) => ({ clientId: v }),
      );
      if (normalizedExclude) {
        nots.push({ clientId: { endsWith: `:${normalizedExclude}` } });
      }
      whereClause.AND = [{ clientType: 'slack' }, { NOT: nots }];
    }

    // Use bounding box if radius is finite
    if (radius !== Infinity) {
      whereClause.x = { gte: x - radius, lte: x + radius };
      whereClause.y = { gte: y - radius, lte: y + radius };
    }

    const players = await this.prisma.player.findMany({
      where: whereClause,
      include: { playerItems: { include: { item: true } } },
    });

    // Calculate distances and filter by actual radius
    const nearby = players
      .map((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate direction
        let direction = '';
        if (dy > 0) direction += 'north';
        else if (dy < 0) direction += 'south';
        if (dx > 0) direction += 'east';
        else if (dx < 0) direction += 'west';

        const clientType = (p.clientType || 'slack') as ClientType;
        return {
          player: this.fromDatabaseModel(p, clientType),
          distance,
          direction: direction || 'here',
          x: p.x,
          y: p.y,
        };
      })
      .filter((p) => p.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return nearby;
  }

  /**
   * Delete a player from the database
   */
  static async delete(playerId: number): Promise<void> {
    await this.prisma.player.delete({
      where: { id: playerId },
    });
  }

  /**
   * Update last action timestamp for a player
   */
  static async updateLastAction(
    clientId: string,
    clientType: ClientType,
  ): Promise<void> {
    const { clientIdVariants, userId, canonicalType } = buildClientIdVariants(
      clientId,
      clientType,
    );

    const orClauses: Array<
      { clientId: string } | { clientId: { endsWith: string } }
    > = [];
    clientIdVariants.forEach((id) => {
      orClauses.push({ clientId: id });
    });
    if (canonicalType === 'slack' && userId && userId.length > 0) {
      orClauses.push({ clientId: { endsWith: `:${userId}` } });
    }

    if (orClauses.length === 0) {
      return;
    }

    await this.prisma.player.updateMany({
      where: {
        OR: orClauses,
      },
      data: { lastAction: new Date() },
    });
  }

  /**
   * Save a player entity to the database
   */
  static async save(entity: PlayerEntity): Promise<void> {
    await this.prisma.player.update({
      where: { id: entity.id },
      data: {
        name: entity.name,
        x: entity.position.x,
        y: entity.position.y,
        hp: entity.combat.hp,
        maxHp: entity.combat.maxHp,
        strength: entity.attributes.strength,
        agility: entity.attributes.agility,
        health: entity.attributes.health,
        gold: entity.gold,
        xp: entity.xp,
        level: entity.level,
        skillPoints: entity.skillPoints,
        isAlive: entity.combat.isAlive,
        // Equipment is managed via playerItems relations; do not persist
        // legacy item columns here.
      },
    });
  }

  /**
   * Convert database model to PlayerEntity
   */
  static fromDatabaseModel(
    player: Player,
    clientType: ClientType,
  ): PlayerEntity {
    const fallbackType = isClientType(player.clientType)
      ? (player.clientType as ClientType)
      : clientType;

    const { id: parsedClientId, type: parsedClientType } =
      normalizeClientIdentifier(player.clientId, fallbackType);

    let resolvedClientId = parsedClientId;
    let resolvedClientType = parsedClientType;

    if (!resolvedClientId) {
      resolvedClientId = '';
    }

    if (!isClientType(resolvedClientType)) {
      resolvedClientType = clientType;
    }

    return new PlayerEntity({
      id: player.id,
      clientId: resolvedClientId,
      clientType: resolvedClientType,
      name: player.name,
      attributes: {
        strength: player.strength,
        agility: player.agility,
        health: player.health,
      },
      combat: {
        hp: player.hp,
        maxHp: player.maxHp,
        isAlive: player.isAlive,
      },
      position: {
        x: player.x,
        y: player.y,
      },
      gold: player.gold,
      xp: player.xp,
      level: player.level,
      skillPoints: player.skillPoints,
      partyId: undefined, // TODO: Add when party system is implemented
      // Build equipment from playerItems relation if present (preferred), otherwise empty slots
      equipment: ((): Record<string, number | null> => {
        const defaultEquip: Record<string, number | null> = {
          head: null,
          chest: null,
          legs: null,
          arms: null,
          weapon: null,
        };
        const playerItems = (
          player as unknown as { playerItems?: Array<Record<string, unknown>> }
        ).playerItems;
        if (Array.isArray(playerItems)) {
          for (const pi of playerItems) {
            const equipped = pi?.equipped ?? false;
            if (!equipped) continue;

            // Prefer the player's assigned slot; fall back to the item's
            // declared slot (pi.item?.slot). If the item has type 'weapon'
            // and no slot is present, treat it as a 'weapon'.
            let slot: string | undefined =
              typeof pi?.slot === 'string' ? (pi.slot as string) : undefined;
            const item = (pi as unknown as { item?: Record<string, unknown> })
              .item;
            const itemSlot =
              typeof item?.slot === 'string'
                ? (item!.slot as string)
                : undefined;
            const itemType =
              typeof item?.type === 'string'
                ? (item!.type as string)
                : undefined;
            if (!slot) {
              if (itemSlot) slot = itemSlot;
              else if (itemType === 'weapon') slot = 'weapon';
            }

            const itemId = pi?.itemId ?? null;
            if (!slot || itemId === null || itemId === undefined) continue;
            if (slot === 'head') defaultEquip.head = Number(itemId);
            else if (slot === 'chest') defaultEquip.chest = Number(itemId);
            else if (slot === 'legs') defaultEquip.legs = Number(itemId);
            else if (slot === 'arms') defaultEquip.arms = Number(itemId);
            else if (slot === 'weapon') defaultEquip.weapon = Number(itemId);
          }
        }
        // No legacy column fallback: equipment is derived only from the
        // player's playerItems relation.

        return defaultEquip;
      })(),
    });
  }

  /**
   * Count players active within a time threshold
   */
  static async countActivePlayers(minutesThreshold: number): Promise<number> {
    const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);
    const count = await this.prisma.player.count({
      where: {
        lastAction: {
          gte: thresholdDate,
        },
      },
    });
    return count;
  }

  /**
   * Generate random starting stats for a new player
   */
  private static generateRandomStats(): {
    strength: number;
    agility: number;
    health: number;
    maxHp: number;
  } {
    // Roll 3d6 for each stat (range: 3-18)
    const rollStat = () => {
      return (
        Math.floor(Math.random() * 6) +
        1 +
        Math.floor(Math.random() * 6) +
        1 +
        Math.floor(Math.random() * 6) +
        1
      );
    };

    const strength = rollStat();
    const agility = rollStat();
    const health = rollStat();

    // Calculate starting HP: 10 base + (health * 2)
    const maxHp = 10 + health * 2;

    return { strength, agility, health, maxHp };
  }
}
