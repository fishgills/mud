import { Injectable } from '@nestjs/common';
import { getPrismaClient, CombatLog } from '@mud/database';
import { PlayerService } from '../player/player.service';
import { MonsterService } from '../monster/monster.service';

export interface CombatResult {
  success: boolean;
  damage: number;
  attackerName: string;
  defenderName: string;
  defenderHp: number;
  defenderMaxHp: number;
  isDead: boolean;
  message: string;
  xpGained?: number;
}

@Injectable()
export class CombatService {
  private prisma = getPrismaClient();

  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService
  ) {}

  // Calculate damage based on D&D-like mechanics
  private calculateDamage(
    attackerStrength: number,
    defenderAgility: number
  ): number {
    // Base damage is 1d6 + strength modifier
    const baseDamage = Math.floor(Math.random() * 6) + 1;
    const strengthModifier = Math.floor((attackerStrength - 10) / 2);

    // Agility affects dodge chance (higher agility = better dodge)
    const dodgeChance = Math.max(0, (defenderAgility - 10) * 0.05); // 5% per point above 10

    if (Math.random() < dodgeChance) {
      return 0; // Dodged!
    }

    return Math.max(1, baseDamage + strengthModifier);
  }

  private calculateXpGain(monsterType: string): number {
    const baseXp: Record<string, number> = {
      goblin: 25,
      orc: 50,
      wolf: 40,
      bear: 75,
      skeleton: 30,
    };

    return baseXp[monsterType] || 25;
  }

  async playerAttackMonster(
    playerSlackId: string,
    monsterId: number
  ): Promise<CombatResult> {
    const player = await this.playerService.getPlayer(playerSlackId);
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId, isAlive: true },
    });

    if (!monster) {
      throw new Error('Monster not found or already dead');
    }

    if (!player.isAlive) {
      throw new Error('Player is dead and cannot attack');
    }

    // Check if player and monster are at the same location
    if (player.x !== monster.x || player.y !== monster.y) {
      throw new Error('Monster is not at your location');
    }

    const damage = this.calculateDamage(player.strength, monster.agility);
    const updatedMonster = await this.monsterService.damageMonster(
      monsterId,
      damage
    );

    // Log the combat
    await this.prisma.combatLog.create({
      data: {
        attackerId: player.id,
        attackerType: 'player',
        defenderId: monster.id,
        defenderType: 'monster',
        damage,
        x: player.x,
        y: player.y,
      },
    });

    let xpGained = 0;
    let message = '';

    if (damage === 0) {
      message = `${player.name} attacks ${monster.name} but misses!`;
    } else if (!updatedMonster.isAlive) {
      xpGained = this.calculateXpGain(monster.type);
      await this.playerService.updatePlayerStats(playerSlackId, {
        xp: player.xp + xpGained,
      });
      message = `${player.name} defeats ${monster.name} for ${damage} damage and gains ${xpGained} XP!`;
    } else {
      message = `${player.name} attacks ${monster.name} for ${damage} damage!`;
    }

    return {
      success: true,
      damage,
      attackerName: player.name,
      defenderName: monster.name,
      defenderHp: updatedMonster.hp,
      defenderMaxHp: updatedMonster.maxHp,
      isDead: !updatedMonster.isAlive,
      message,
      xpGained,
    };
  }

  async monsterAttackPlayer(
    monsterId: number,
    playerSlackId: string
  ): Promise<CombatResult> {
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId, isAlive: true },
    });
    const player = await this.playerService.getPlayer(playerSlackId);

    if (!monster || !player.isAlive) {
      throw new Error('Monster or player not found/alive');
    }

    const damage = this.calculateDamage(monster.strength, player.agility);
    const updatedPlayer = await this.playerService.damagePlayer(
      playerSlackId,
      damage
    );

    // Log the combat
    await this.prisma.combatLog.create({
      data: {
        attackerId: monster.id,
        attackerType: 'monster',
        defenderId: player.id,
        defenderType: 'player',
        damage,
        x: monster.x,
        y: monster.y,
      },
    });

    let message = '';
    if (damage === 0) {
      message = `${monster.name} attacks ${player.name} but misses!`;
    } else if (!updatedPlayer.isAlive) {
      message = `${monster.name} defeats ${player.name} for ${damage} damage! ${player.name} has died!`;
    } else {
      message = `${monster.name} attacks ${player.name} for ${damage} damage!`;
    }

    return {
      success: true,
      damage,
      attackerName: monster.name,
      defenderName: player.name,
      defenderHp: updatedPlayer.hp,
      defenderMaxHp: updatedPlayer.maxHp,
      isDead: !updatedPlayer.isAlive,
      message,
    };
  }

  async playerAttackPlayer(
    attackerSlackId: string,
    defenderSlackId: string
  ): Promise<CombatResult> {
    const attacker = await this.playerService.getPlayer(attackerSlackId);
    const defender = await this.playerService.getPlayer(defenderSlackId);

    if (!attacker.isAlive || !defender.isAlive) {
      throw new Error('One or both players are dead');
    }

    // Check if players are at the same location
    if (attacker.x !== defender.x || attacker.y !== defender.y) {
      throw new Error('Defender is not at your location');
    }

    const damage = this.calculateDamage(attacker.strength, defender.agility);
    const updatedDefender = await this.playerService.damagePlayer(
      defenderSlackId,
      damage
    );

    // Log the combat
    await this.prisma.combatLog.create({
      data: {
        attackerId: attacker.id,
        attackerType: 'player',
        defenderId: defender.id,
        defenderType: 'player',
        damage,
        x: attacker.x,
        y: attacker.y,
      },
    });

    let message = '';
    if (damage === 0) {
      message = `${attacker.name} attacks ${defender.name} but misses!`;
    } else if (!updatedDefender.isAlive) {
      message = `${attacker.name} defeats ${defender.name} for ${damage} damage! ${defender.name} has died!`;
    } else {
      message = `${attacker.name} attacks ${defender.name} for ${damage} damage!`;
    }

    return {
      success: true,
      damage,
      attackerName: attacker.name,
      defenderName: defender.name,
      defenderHp: updatedDefender.hp,
      defenderMaxHp: updatedDefender.maxHp,
      isDead: !updatedDefender.isAlive,
      message,
    };
  }

  async getCombatLogForLocation(
    x: number,
    y: number,
    limit = 10
  ): Promise<CombatLog[]> {
    return this.prisma.combatLog.findMany({
      where: { x, y },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
