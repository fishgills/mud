import { Injectable } from '@nestjs/common';
import { getPrismaClient, CombatLog as PrismaCombatLog } from '@mud/database';
import { PlayerService } from '../player/player.service';

export interface Combatant {
  id: number;
  name: string;
  type: 'player' | 'monster';
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  level: number;
  isAlive: boolean;
  x: number;
  y: number;
}

export interface CombatRound {
  roundNumber: number;
  attackerName: string;
  defenderName: string;
  attackRoll: number;
  attackModifier: number;
  totalAttack: number;
  defenderAC: number;
  hit: boolean;
  damage: number;
  defenderHpAfter: number;
  killed: boolean;
}

export interface DetailedCombatLog {
  combatId: string;
  participant1: string;
  participant2: string;
  initiativeRolls: {
    name: string;
    roll: number;
    modifier: number;
    total: number;
  }[];
  firstAttacker: string;
  rounds: CombatRound[];
  winner: string;
  loser: string;
  xpAwarded: number;
  timestamp: Date;
  location: { x: number; y: number };
}

export interface CombatResult {
  success: boolean;
  combatLog: DetailedCombatLog;
  winnerName: string;
  loserName: string;
  totalDamageDealt: number;
  roundsCompleted: number;
  xpGained: number;
  message: string;
}

@Injectable()
export class CombatService {
  private prisma = getPrismaClient();

  constructor(private playerService: PlayerService) {}

  // Roll 1d20
  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  // Roll multiple dice (e.g., "20d10" for XP calculation)
  private rollDice(count: number, sides: number): number {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
  }

  // Calculate ability modifier (D&D 3e style: (ability - 10) / 2)
  private getModifier(ability: number): number {
    return Math.floor((ability - 10) / 2);
  }

  // Calculate Armor Class (10 + Dex modifier)
  private calculateAC(agility: number): number {
    return 10 + this.getModifier(agility);
  }

  // Calculate initiative (1d20 + Dex modifier)
  private rollInitiative(agility: number): {
    roll: number;
    modifier: number;
    total: number;
  } {
    const roll = this.rollD20();
    const modifier = this.getModifier(agility);
    return { roll, modifier, total: roll + modifier };
  }

  // Calculate damage (1d6 + Str modifier, minimum 1)
  private calculateDamage(strength: number): number {
    const baseDamage = Math.floor(Math.random() * 6) + 1;
    const modifier = this.getModifier(strength);
    return Math.max(1, baseDamage + modifier);
  }

  // Calculate XP gain based on level difference and 20d10
  private calculateXpGain(winnerLevel: number, loserLevel: number): number {
    const levelRatio = loserLevel / winnerLevel;
    const baseXp = this.rollDice(20, 10); // 20d10
    return Math.max(10, Math.floor(levelRatio * baseXp));
  }

  // Convert Player/Monster to Combatant interface
  private async playerToCombatant(slackId: string): Promise<Combatant> {
    const player = await this.playerService.getPlayer(slackId);
    return {
      id: player.id,
      name: player.name,
      type: 'player',
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      agility: player.agility,
      level: player.level,
      isAlive: player.isAlive,
      x: player.x,
      y: player.y,
    };
  }

  private async monsterToCombatant(monsterId: number): Promise<Combatant> {
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId, isAlive: true },
    });
    if (!monster) {
      throw new Error('Monster not found or already dead');
    }
    return {
      id: monster.id,
      name: monster.name,
      type: 'monster',
      hp: monster.hp,
      maxHp: monster.maxHp,
      strength: monster.strength,
      agility: monster.agility,
      level: 1, // Default to level 1 for monsters
      isAlive: monster.isAlive,
      x: monster.x,
      y: monster.y,
    };
  }

  // Core combat logic - handles full D&D style combat
  private async runCombat(
    combatant1: Combatant,
    combatant2: Combatant,
  ): Promise<DetailedCombatLog> {
    const combatId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Roll initiative
    const init1 = this.rollInitiative(combatant1.agility);
    const init2 = this.rollInitiative(combatant2.agility);

    const initiativeRolls = [
      { name: combatant1.name, ...init1 },
      { name: combatant2.name, ...init2 },
    ];

    // Determine who goes first
    let attacker = init1.total >= init2.total ? combatant1 : combatant2;
    let defender = init1.total >= init2.total ? combatant2 : combatant1;
    const firstAttacker = attacker.name;

    const rounds: CombatRound[] = [];
    let roundNumber = 1;

    // Combat loop - continue until someone dies
    while (attacker.isAlive && defender.isAlive && roundNumber <= 100) {
      // Safety limit
      // Attacker attacks defender
      const attackRoll = this.rollD20();
      const attackModifier = this.getModifier(attacker.strength);
      const totalAttack = attackRoll + attackModifier;
      const defenderAC = this.calculateAC(defender.agility);
      const hit = totalAttack >= defenderAC;

      let damage = 0;
      let killed = false;

      if (hit) {
        damage = this.calculateDamage(attacker.strength);
        defender.hp = Math.max(0, defender.hp - damage);
        if (defender.hp <= 0) {
          defender.isAlive = false;
          killed = true;
        }
      }

      rounds.push({
        roundNumber,
        attackerName: attacker.name,
        defenderName: defender.name,
        attackRoll,
        attackModifier,
        totalAttack,
        defenderAC,
        hit,
        damage,
        defenderHpAfter: defender.hp,
        killed,
      });

      if (killed) break;

      // Switch roles for next attack
      [attacker, defender] = [defender, attacker];

      // Only increment round number after both combatants have attacked
      if (roundNumber % 2 === 0) {
        roundNumber++;
      } else {
        roundNumber++;
      }
    }

    const winner = combatant1.isAlive ? combatant1 : combatant2;
    const loser = combatant1.isAlive ? combatant2 : combatant1;
    const xpAwarded = this.calculateXpGain(winner.level, loser.level);

    return {
      combatId,
      participant1: combatant1.name,
      participant2: combatant2.name,
      initiativeRolls,
      firstAttacker,
      rounds,
      winner: winner.name,
      loser: loser.name,
      xpAwarded,
      timestamp: new Date(),
      location: { x: combatant1.x, y: combatant1.y },
    };
  }

  // Update HP in database and award XP
  private async applyCombatResults(
    combatLog: DetailedCombatLog,
    combatant1: Combatant,
    combatant2: Combatant,
  ): Promise<void> {
    const winner =
      combatant1.name === combatLog.winner ? combatant1 : combatant2;
    const loser = combatant1.name === combatLog.loser ? combatant1 : combatant2;

    // Update loser's HP
    if (loser.type === 'player') {
      await this.playerService.updatePlayerStats(loser.id.toString(), {
        hp: loser.hp,
      });
      if (!loser.isAlive) {
        await this.playerService.respawnPlayer(loser.id.toString());
      }
    } else {
      await this.prisma.monster.update({
        where: { id: loser.id },
        data: { hp: loser.hp, isAlive: loser.isAlive },
      });
    }

    // Award XP to winner if they're a player
    if (winner.type === 'player') {
      const currentPlayer = await this.playerService.getPlayer(
        winner.id.toString(),
      );
      await this.playerService.updatePlayerStats(winner.id.toString(), {
        xp: currentPlayer.xp + combatLog.xpAwarded,
      });
    }

    // Log to database for history
    await this.prisma.combatLog.create({
      data: {
        attackerId: winner.id,
        attackerType: winner.type,
        defenderId: loser.id,
        defenderType: loser.type,
        damage: combatLog.rounds.reduce(
          (total, round) => total + round.damage,
          0,
        ),
        x: combatLog.location.x,
        y: combatLog.location.y,
      },
    });
  }

  async playerAttackMonster(
    playerSlackId: string,
    monsterId: number,
  ): Promise<CombatResult> {
    const player = await this.playerToCombatant(playerSlackId);
    const monster = await this.monsterToCombatant(monsterId);

    if (!player.isAlive) {
      throw new Error('Player is dead and cannot attack');
    }

    // Check if player and monster are at the same location
    if (player.x !== monster.x || player.y !== monster.y) {
      throw new Error('Monster is not at your location');
    }

    const combatLog = await this.runCombat(player, monster);
    await this.applyCombatResults(combatLog, player, monster);

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === player.name)
      .reduce((total, round) => total + round.damage, 0);

    return {
      success: true,
      combatLog,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === player.name ? combatLog.xpAwarded : 0,
      message: `${combatLog.winner} defeats ${combatLog.loser} after ${Math.ceil(combatLog.rounds.length / 2)} rounds of combat!`,
    };
  }

  async monsterAttackPlayer(
    monsterId: number,
    playerSlackId: string,
  ): Promise<CombatResult> {
    const monster = await this.monsterToCombatant(monsterId);
    const player = await this.playerToCombatant(playerSlackId);

    if (!player.isAlive || !monster.isAlive) {
      throw new Error('Monster or player not found/alive');
    }

    const combatLog = await this.runCombat(monster, player);
    await this.applyCombatResults(combatLog, monster, player);

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === monster.name)
      .reduce((total, round) => total + round.damage, 0);

    return {
      success: true,
      combatLog,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === player.name ? combatLog.xpAwarded : 0,
      message: `${combatLog.winner} defeats ${combatLog.loser} after ${Math.ceil(combatLog.rounds.length / 2)} rounds of combat!`,
    };
  }

  async playerAttackPlayer(
    attackerSlackId: string,
    defenderSlackId: string,
  ): Promise<CombatResult> {
    const attacker = await this.playerToCombatant(attackerSlackId);
    const defender = await this.playerToCombatant(defenderSlackId);

    if (!attacker.isAlive || !defender.isAlive) {
      throw new Error('One or both players are dead');
    }

    // Check if players are at the same location
    if (attacker.x !== defender.x || attacker.y !== defender.y) {
      throw new Error('Defender is not at your location');
    }

    const combatLog = await this.runCombat(attacker, defender);
    await this.applyCombatResults(combatLog, attacker, defender);

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === attacker.name)
      .reduce((total, round) => total + round.damage, 0);

    return {
      success: true,
      combatLog,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === attacker.name ? combatLog.xpAwarded : 0,
      message: `${combatLog.winner} defeats ${combatLog.loser} after ${Math.ceil(combatLog.rounds.length / 2)} rounds of combat!`,
    };
  }

  async getCombatLogForLocation(
    x: number,
    y: number,
    limit = 10,
  ): Promise<PrismaCombatLog[]> {
    return this.prisma.combatLog.findMany({
      where: { x, y },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
