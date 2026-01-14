import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient, type Monster } from '@mud/database';
import { EventBus } from '../../shared/event-bus';
import {
  MONSTER_TEMPLATES,
  getMonsterTemplate,
  rollVariant,
  formatMonsterName,
  VARIANT_CONFIG,
  type MonsterTemplate,
} from './monster.types';

@Injectable()
export class MonsterService {
  private prisma = getPrismaClient();
  private readonly logger = new Logger(MonsterService.name);

  async getMonsterById(monsterId: number): Promise<Monster | null> {
    return this.prisma.monster.findUnique({ where: { id: monsterId } });
  }

  async getAllMonsters(): Promise<Monster[]> {
    return this.prisma.monster.findMany();
  }

  async spawnMonster(type?: string): Promise<Monster> {
    const template = type
      ? getMonsterTemplate(type)
      : MONSTER_TEMPLATES[Math.floor(Math.random() * MONSTER_TEMPLATES.length)];

    if (!template) {
      throw new Error('Monster template not found');
    }

    const monster = await this.createMonster(template);
    await EventBus.emit({
      eventType: 'monster:spawn',
      monster,
      timestamp: new Date(),
    });

    this.logger.debug(`Spawned monster ${monster.name} (id=${monster.id})`);
    return monster;
  }

  private async createMonster(template: MonsterTemplate): Promise<Monster> {
    const variant = rollVariant();
    const variantConfig = VARIANT_CONFIG[variant];

    const variance = () => Math.floor(Math.random() * 5) - 2;

    const strength = Math.max(
      1,
      template.strength + variance() + variantConfig.statModifier,
    );
    const agility = Math.max(
      1,
      template.agility + variance() + variantConfig.statModifier,
    );
    const health = Math.max(
      1,
      template.health + variance() + variantConfig.statModifier,
    );

    const baseMaxHp = template.baseHp + health * 2;
    const maxHp = Math.max(
      1,
      Math.floor(baseMaxHp * variantConfig.hpMultiplier),
    );

    const displayName = formatMonsterName(template.name, variant);

    return this.prisma.monster.create({
      data: {
        name: displayName,
        type: template.type,
        variant,
        tier: template.tier,
        hp: maxHp,
        maxHp,
        strength,
        agility,
        health,
        isAlive: true,
        damageRoll: template.damageRoll,
      },
    });
  }
}
