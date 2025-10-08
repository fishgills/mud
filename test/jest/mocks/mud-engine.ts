import { getPrismaClient } from '@mud/database';
import { rollAbilityScore } from '../../libs/engine/src/utils/dice.js';

export type ClientType = 'slack' | 'discord' | 'web';

interface PlayerAttributes {
  strength: number;
  agility: number;
  health: number;
}

interface PlayerCombat {
  hp: number;
  maxHp: number;
  isAlive: boolean;
}

interface PlayerPosition {
  x: number;
  y: number;
}

export interface PlayerEntityData {
  id: number;
  clientId: string;
  clientType: ClientType;
  name: string;
  attributes: PlayerAttributes;
  combat: PlayerCombat;
  position: PlayerPosition;
  gold: number;
  xp: number;
  level: number;
  skillPoints: number;
  lastAction?: Date;
}

export class PlayerEntity {
  public readonly id: number;
  public readonly clientId: string;
  public readonly clientType: ClientType;
  public name: string;
  public attributes: PlayerAttributes;
  public combat: PlayerCombat;
  public position: PlayerPosition;
  public gold: number;
  public xp: number;
  public level: number;
  public skillPoints: number;
  public lastAction?: Date;

  constructor(data: PlayerEntityData) {
    this.id = data.id;
    this.clientId = data.clientId;
    this.clientType = data.clientType;
    this.name = data.name;
    this.attributes = { ...data.attributes };
    this.combat = { ...data.combat };
    this.position = { ...data.position };
    this.gold = data.gold;
    this.xp = data.xp;
    this.level = data.level;
    this.skillPoints = data.skillPoints;
    this.lastAction = data.lastAction;
  }

  moveTo(x: number, y: number): void {
    this.position = { x, y };
  }

  heal(amount: number): void {
    if (amount <= 0) return;
    this.combat.hp = Math.min(this.combat.hp + amount, this.combat.maxHp);
    if (this.combat.hp > 0) {
      this.combat.isAlive = true;
    }
  }

  takeDamage(amount: number): void {
    if (amount <= 0) return;
    this.combat.hp = Math.max(0, this.combat.hp - amount);
    if (this.combat.hp === 0) {
      this.combat.isAlive = false;
    }
  }

  spendSkillPoint(attribute: keyof PlayerAttributes): boolean {
    if (this.skillPoints <= 0) {
      return false;
    }

    const currentValue = this.attributes[attribute];
    if (currentValue >= 20) {
      return false;
    }

    this.attributes[attribute] = currentValue + 1;
    this.skillPoints -= 1;

    if (attribute === 'health') {
      this.applyConstitutionAdjustment(currentValue, currentValue + 1);
    }

    return true;
  }

  private applyConstitutionAdjustment(previousHealth: number, newHealth: number) {
    const previousModifier = this.getConstitutionModifier(previousHealth);
    const newModifier = this.getConstitutionModifier(newHealth);
    const delta = newModifier - previousModifier;

    if (delta === 0) {
      return;
    }

    const hpChange = delta * this.level;
    this.combat.maxHp = Math.max(1, this.combat.maxHp + hpChange);
    if (hpChange > 0) {
      this.combat.hp = Math.min(this.combat.hp + hpChange, this.combat.maxHp);
    } else {
      this.combat.hp = Math.min(this.combat.hp, this.combat.maxHp);
    }
  }

  private getConstitutionModifier(health: number): number {
    return Math.floor((health - 10) / 2);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      clientId: this.clientId,
      clientType: this.clientType,
      name: this.name,
      attributes: { ...this.attributes },
      combat: { ...this.combat },
      position: { ...this.position },
      gold: this.gold,
      xp: this.xp,
      level: this.level,
      skillPoints: this.skillPoints,
      lastAction: this.lastAction?.toISOString(),
    };
  }

  getEntityType(): string {
    return 'player';
  }
}

export const EventBus = {
  async emit(): Promise<void> {
    // no-op in tests
  },
  on(): void {
    // no-op
  },
  off(): void {
    // no-op
  },
};

interface CreatePlayerOptions {
  clientId: string;
  clientType: ClientType;
  name: string;
  x?: number;
  y?: number;
}

export class PlayerFactory {
  private static prisma = getPrismaClient();
  private static readonly HIT_DIE_MAX = 10;

  static async create(options: CreatePlayerOptions): Promise<PlayerEntity> {
    const { clientId, clientType, name, x = 0, y = 0 } = options;
    const stats = this.generateRandomStats();
    const fullClientId = `${clientType}:${clientId}`;

    const record = await this.prisma.player.create({
      data: {
        slackId: clientType === 'slack' ? clientId : undefined,
        clientId: fullClientId,
        clientType,
        name,
        x,
        y,
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
        lastAction: new Date(),
      },
    });

    return this.fromDatabaseModel(record);
  }

  static async load(
    clientId: string,
    clientType: ClientType,
  ): Promise<PlayerEntity | null> {
    const fullClientId = `${clientType}:${clientId}`;
    const record = await this.prisma.player.findFirst({
      where: {
        OR: [
          { clientId: fullClientId },
          { clientId },
          { slackId: clientId },
        ],
      },
    });

    return record ? this.fromDatabaseModel(record) : null;
  }

  static async loadByName(name: string): Promise<PlayerEntity | null> {
    const normalized = name.toLowerCase();
    const matches = await this.prisma.player.findMany();
    const filtered = matches.filter(
      (p: any) => (p.name as string).toLowerCase() === normalized,
    );

    if (filtered.length === 0) {
      return null;
    }

    if (filtered.length > 1) {
      throw new Error(
        `Multiple players found with the name "${name}". IDs: ${filtered
          .map((p: any) => p.id)
          .join(', ')}`,
      );
    }

    return this.fromDatabaseModel(filtered[0]);
  }

  static async loadAll(): Promise<PlayerEntity[]> {
    const records = await this.prisma.player.findMany();
    return records.map((record: any) => this.fromDatabaseModel(record));
  }

  static async loadAtLocation(
    x: number,
    y: number,
    options?: { excludePlayerId?: number; aliveOnly?: boolean },
  ): Promise<PlayerEntity[]> {
    const records = await this.prisma.player.findMany();
    return records
      .filter((p: any) => {
        if (options?.aliveOnly && !p.isAlive) {
          return false;
        }
        if (options?.excludePlayerId && p.id === options.excludePlayerId) {
          return false;
        }
        return p.x === x && p.y === y;
      })
      .map((record: any) => this.fromDatabaseModel(record));
  }

  static async loadNearby(
    x: number,
    y: number,
    options?: {
      radius?: number;
      limit?: number;
      excludeSlackId?: string;
      aliveOnly?: boolean;
    },
  ): Promise<Array<{ player: PlayerEntity; distance: number; direction: string }>> {
    const radius = options?.radius ?? Infinity;
    const limit = options?.limit ?? 10;
    const aliveOnly = options?.aliveOnly ?? true;

    const records = await this.prisma.player.findMany();
    const filtered = records
      .filter((p: any) => {
        if (aliveOnly && !p.isAlive) {
          return false;
        }
        if (options?.excludeSlackId && p.slackId === options.excludeSlackId) {
          return false;
        }
        const dx = (p.x ?? 0) - x;
        const dy = (p.y ?? 0) - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= radius;
      })
      .map((p: any) => {
        const dx = (p.x ?? 0) - x;
        const dy = (p.y ?? 0) - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let direction = '';
        if (dy > 0) direction += 'north';
        else if (dy < 0) direction += 'south';
        if (dx > 0) direction += 'east';
        else if (dx < 0) direction += 'west';
        return {
          player: this.fromDatabaseModel(p),
          distance,
          direction: direction || 'here',
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return filtered;
  }

  static async delete(playerId: number): Promise<void> {
    await this.prisma.player.delete({ where: { id: playerId } });
  }

  static async updateLastAction(
    clientId: string,
    clientType: ClientType,
  ): Promise<void> {
    const fullClientId = `${clientType}:${clientId}`;
    await this.prisma.player.updateMany({
      where: {
        OR: [{ clientId: fullClientId }, { clientId }, { slackId: clientId }],
      },
      data: { lastAction: new Date() },
    });
  }

  static async countActivePlayers(minutesThreshold: number): Promise<number> {
    const cutoff = new Date(Date.now() - minutesThreshold * 60 * 1000);
    return this.prisma.player.count({ where: { lastAction: { gte: cutoff } } });
  }

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
        lastAction: entity.lastAction ?? new Date(),
      },
    });
  }

  private static fromDatabaseModel(record: any): PlayerEntity {
    const clientType = (record.clientType ?? 'slack') as ClientType;
    const platformId = typeof record.clientId === 'string'
      ? record.clientId.split(':').pop() ?? record.clientId
      : record.slackId ?? '';

    return new PlayerEntity({
      id: record.id,
      clientId: platformId,
      clientType,
      name: record.name,
      attributes: {
        strength: record.strength,
        agility: record.agility,
        health: record.health,
      },
      combat: {
        hp: record.hp,
        maxHp: record.maxHp,
        isAlive: record.isAlive,
      },
      position: {
        x: record.x ?? 0,
        y: record.y ?? 0,
      },
      gold: record.gold ?? 0,
      xp: record.xp ?? 0,
      level: record.level ?? 1,
      skillPoints: record.skillPoints ?? 0,
      lastAction: record.lastAction ? new Date(record.lastAction) : undefined,
    });
  }

  private static generateRandomStats(): {
    strength: number;
    agility: number;
    health: number;
    maxHp: number;
  } {
    const strength = rollAbilityScore();
    const agility = rollAbilityScore();
    const health = rollAbilityScore();
    const constitutionModifier = Math.floor((health - 10) / 2);
    const maxHp = Math.max(1, this.HIT_DIE_MAX + constitutionModifier);

    return { strength, agility, health, maxHp };
  }
}
