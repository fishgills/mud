import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient, CombatLog as PrismaCombatLog } from '@mud/database';
import { PlayerService } from '../player/player.service';
import { PlayerStatsDto } from '../player/dto/player.dto';
import { AiService } from '../../openai/ai.service';
import { CombatResult, CombatRound, DetailedCombatLog } from '../graphql';

interface CombatNarrative {
  summary: string;
  rounds: string[];
}

interface NarrativeOptions {
  secondPersonName?: string;
}

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
  slackId?: string; // Only for players
}

@Injectable()
export class CombatService {
  private readonly logger = new Logger(CombatService.name);
  private prisma = getPrismaClient();

  constructor(
    private playerService: PlayerService,
    private aiService: AiService,
  ) {}

  // Roll 1d20
  private rollD20(): number {
    const roll = Math.floor(Math.random() * 20) + 1;
    this.logger.debug(`Rolled 1d20: ${roll}`);
    return roll;
  }

  // Roll multiple dice (e.g., "20d10" for XP calculation)
  private rollDice(count: number, sides: number): number {
    let total = 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }
    this.logger.debug(
      `Rolled ${count}d${sides}: ${rolls.join(', ')} = ${total}`,
    );
    return total;
  }

  // Calculate ability modifier (D&D 3e style: (ability - 10) / 2)
  private getModifier(ability: number): number {
    const modifier = Math.floor((ability - 10) / 2);
    this.logger.debug(`Ability ${ability} -> modifier ${modifier}`);
    return modifier;
  }

  // Calculate Armor Class (10 + Dex modifier)
  private calculateAC(agility: number): number {
    const dexMod = this.getModifier(agility);
    const ac = 10 + dexMod;
    this.logger.debug(`AC calculation: 10 + ${dexMod} (Dex) = ${ac}`);
    return ac;
  }

  // Calculate initiative (1d20 + Dex modifier)
  private rollInitiative(agility: number): {
    roll: number;
    modifier: number;
    total: number;
  } {
    const roll = this.rollD20();
    const modifier = this.getModifier(agility);
    const total = roll + modifier;
    this.logger.debug(`Initiative: ${roll} + ${modifier} (Dex) = ${total}`);
    return { roll, modifier, total };
  }

  // Calculate damage (1d6 + Str modifier, minimum 1)
  private calculateDamage(strength: number): number {
    const baseDamage = Math.floor(Math.random() * 6) + 1;
    const modifier = this.getModifier(strength);
    const totalDamage = Math.max(1, baseDamage + modifier);
    this.logger.debug(
      `Damage: ${baseDamage} + ${modifier} (Str) = ${totalDamage} (min 1)`,
    );
    return totalDamage;
  }

  // Calculate XP gain based on level difference and 20d10
  private calculateXpGain(winnerLevel: number, loserLevel: number): number {
    const levelRatio = loserLevel / winnerLevel;
    const baseXp = this.rollDice(20, 10); // 20d10
    const finalXp = Math.max(10, Math.floor(levelRatio * baseXp));
    this.logger.debug(
      `XP calculation: (${loserLevel}/${winnerLevel}) * ${baseXp} = ${finalXp} (min 10)`,
    );
    return finalXp;
  }

  private calculateGoldReward(
    victorLevel: number,
    targetLevel: number,
  ): number {
    const baseGold = this.rollDice(5, 6); // 5d6 baseline treasure
    const levelDifference = targetLevel - victorLevel;
    const modifier = Math.max(0.5, 1 + levelDifference * 0.1);
    const finalGold = Math.max(5, Math.floor(baseGold * modifier));
    this.logger.debug(
      `Gold calculation: base ${baseGold}, level diff ${levelDifference} -> modifier ${modifier.toFixed(
        2,
      )}, final ${finalGold}`,
    );
    return finalGold;
  }

  private formatCombatNarrative(narrative: CombatNarrative): string {
    const lines = ['**Combat Summary:**', narrative.summary.trim()];

    if (narrative.rounds.length) {
      lines.push('', '**Combat Log:**');
      narrative.rounds.forEach((line, index) => {
        lines.push(`Round ${index + 1}: ${line.trim()}`);
      });
    }

    return lines.join('\n');
  }

  private describeRound(
    round: CombatRound,
    options: NarrativeOptions = {},
  ): string {
    const { secondPersonName } = options;
    const attackerIsYou = secondPersonName === round.attackerName;
    const defenderIsYou = secondPersonName === round.defenderName;

    if (round.hit) {
      if (attackerIsYou) {
        const base = `You strike ${round.defenderName} for ${round.damage} damage`;
        if (round.killed) {
          return `${base}, defeating them!`;
        }
        return `${base}!`;
      }

      if (defenderIsYou) {
        const base = `${round.attackerName} hits you for ${round.damage} damage`;
        if (round.killed) {
          return `${base}, leaving you defeated!`;
        }
        return `${base}!`;
      }

      const base = `${round.attackerName} hits ${round.defenderName} for ${round.damage} damage`;
      if (round.killed) {
        return `${base}, slaying them!`;
      }
      return `${base}!`;
    }

    if (attackerIsYou) {
      return `You swing at ${round.defenderName} but miss.`;
    }

    if (defenderIsYou) {
      return `${round.attackerName} swings at you but misses.`;
    }

    return `${round.attackerName} swings at ${round.defenderName} but misses.`;
  }

  private createFallbackNarrative(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ): CombatNarrative {
    const summary = `${combatLog.winner} defeats ${combatLog.loser} after ${Math.ceil(combatLog.rounds.length / 2)} rounds of combat.`;
    const rounds = combatLog.rounds.map((round) =>
      this.describeRound(round, options),
    );

    return { summary, rounds };
  }

  private async generateCombatNarrative(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ): Promise<string> {
    const context = {
      combat: {
        id: combatLog.combatId,
        participant1: combatLog.participant1,
        participant2: combatLog.participant2,
        winner: combatLog.winner,
        loser: combatLog.loser,
        roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
        xpAwarded: combatLog.xpAwarded,
        totalDamageDealt: combatLog.rounds.reduce(
          (sum, round) => sum + round.damage,
          0,
        ),
        initiativeWinner: combatLog.firstAttacker,
        location: combatLog.location,
        rounds: combatLog.rounds.map((round) => ({
          number: round.roundNumber,
          attacker: round.attackerName,
          defender: round.defenderName,
          hit: round.hit,
          damage: round.damage,
          killed: round.killed,
        })),
      },
      perspective: options.secondPersonName
        ? {
            treatAsYou: options.secondPersonName,
          }
        : undefined,
    };

    const instructions = options.secondPersonName
      ? `Refer to "${options.secondPersonName}" as "you" when narrating and use their opponents' names normally.`
      : 'Use third-person narration for all combatants.';

    const prompt = [
      'You are a fantasy combat narrator transforming structured battle data into an exciting Slack message.',
      'Respond ONLY with minified JSON that matches this TypeScript type: { "summary": string, "rounds": string[] }.',
      'Summary rules: 1-2 sentences highlighting momentum, the victor, and dramatic flair.',
      'Round rules: Provide one entry per round in order. Mention who attacks whom, whether it hits or misses, include damage numbers for hits, and note if the defender is defeated.',
      instructions,
      'Keep the language vivid but concise. Do not invent events that are not in the data.',
      'Combat data:',
      JSON.stringify(context, null, 2),
    ].join('\n');

    this.logger.debug(`Combat narrative AI prompt: ${prompt}`);

    try {
      const ai = await this.aiService.getText(prompt, {
        timeoutMs: 1500,
        cacheKey: `combat:${combatLog.winner}:${combatLog.loser}:${combatLog.rounds.length}:${combatLog.xpAwarded}:${options.secondPersonName ?? 'neutral'}`,
        maxTokens: 500,
      });

      const rawText = (ai?.output_text ?? '').trim();
      if (rawText) {
        this.logger.debug(`AI combat narrative generated: ${rawText}`);
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        const parsed = JSON.parse(cleaned) as Partial<CombatNarrative>;
        if (
          parsed.summary &&
          typeof parsed.summary === 'string' &&
          Array.isArray(parsed.rounds) &&
          parsed.rounds.every((round) => typeof round === 'string')
        ) {
          return this.formatCombatNarrative({
            summary: parsed.summary,
            rounds: parsed.rounds,
          });
        }
        this.logger.debug('AI combat narrative response missing required fields, using fallback.');
      }
    } catch (error) {
      this.logger.debug(`AI combat narrative generation failed: ${error}`);
    }

    const fallback = this.createFallbackNarrative(combatLog, options);
    this.logger.debug(
      `Using fallback combat narrative: ${JSON.stringify(fallback)}`,
    );
    return this.formatCombatNarrative(fallback);
  }

  // Convert Player/Monster to Combatant interface
  private async playerToCombatant(slackId: string): Promise<Combatant> {
    const player = await this.playerService.getPlayer(slackId);
    const combatant = {
      id: player.id,
      name: player.name,
      type: 'player' as const,
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      agility: player.agility,
      level: player.level,
      isAlive: player.isAlive,
      x: player.x,
      y: player.y,
      slackId: slackId, // Store the Slack ID for later use
    };
    this.logger.debug(
      `Player combatant: ${combatant.name} (Str:${combatant.strength}, Agi:${combatant.agility}, HP:${combatant.hp}/${combatant.maxHp}, Lvl:${combatant.level})`,
    );
    return combatant;
  }

  private async monsterToCombatant(monsterId: number): Promise<Combatant> {
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId, isAlive: true },
    });
    if (!monster) {
      throw new Error('Monster not found or already dead');
    }
    const combatant = {
      id: monster.id,
      name: monster.name,
      type: 'monster' as const,
      hp: monster.hp,
      maxHp: monster.maxHp,
      strength: monster.strength,
      agility: monster.agility,
      level: 1, // Default to level 1 for monsters
      isAlive: monster.isAlive,
      x: monster.x,
      y: monster.y,
    };
    this.logger.debug(
      `Monster combatant: ${combatant.name} (Str:${combatant.strength}, Agi:${combatant.agility}, HP:${combatant.hp}/${combatant.maxHp}, Lvl:${combatant.level})`,
    );
    return combatant;
  }

  // Core combat logic - handles full D&D style combat
  private async runCombat(
    combatant1: Combatant,
    combatant2: Combatant,
  ): Promise<DetailedCombatLog> {
    const combatId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.log(
      `🗡️ COMBAT START: ${combatant1.name} vs ${combatant2.name} [ID: ${combatId}]`,
    );

    // Roll initiative
    this.logger.debug(`Rolling initiative...`);
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

    this.logger.log(
      `⚡ Initiative Results: ${combatant1.name}=${init1.total}, ${combatant2.name}=${init2.total} | ${firstAttacker} goes first!`,
    );

    const rounds: CombatRound[] = [];
    let roundNumber = 1;

    // Combat loop - continue until someone dies
    this.logger.debug(`Starting combat loop...`);
    while (attacker.isAlive && defender.isAlive && roundNumber <= 100) {
      // Safety limit
      this.logger.debug(
        `⚔️ Round ${roundNumber}: ${attacker.name} attacks ${defender.name}`,
      );

      // Attacker attacks defender
      const attackRoll = this.rollD20();
      const attackModifier = this.getModifier(attacker.strength);
      const totalAttack = attackRoll + attackModifier;
      const defenderAC = this.calculateAC(defender.agility);
      const hit = totalAttack >= defenderAC;

      this.logger.debug(
        `Attack roll: ${attackRoll} + ${attackModifier} = ${totalAttack} vs AC ${defenderAC} -> ${hit ? 'HIT' : 'MISS'}`,
      );

      let damage = 0;
      let killed = false;

      if (hit) {
        damage = this.calculateDamage(attacker.strength);
        const oldHp = defender.hp;
        defender.hp = Math.max(0, defender.hp - damage);
        this.logger.debug(
          `💥 ${attacker.name} hits ${defender.name} for ${damage} damage! HP: ${oldHp} -> ${defender.hp}`,
        );

        if (defender.hp <= 0) {
          defender.isAlive = false;
          killed = true;
          this.logger.log(`💀 ${defender.name} is defeated!`);
        }
      } else {
        this.logger.debug(`🛡️ ${attacker.name} misses ${defender.name}`);
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

      this.logger.debug(`Turn switch: Next attacker is ${attacker.name}`);

      // Only increment round number after both combatants have attacked
      if (roundNumber % 2 === 0) {
        roundNumber++;
      } else {
        roundNumber++;
      }
    }

    this.logger.log(
      `🏁 Combat completed after ${Math.ceil((roundNumber - 1) / 2)} full rounds`,
    );

    const winner = combatant1.isAlive ? combatant1 : combatant2;
    const loser = combatant1.isAlive ? combatant2 : combatant1;
    const xpAwarded = this.calculateXpGain(loser.level, winner.level);
    const goldAwarded = this.calculateGoldReward(winner.level, loser.level);

    this.logger.log(`🏆 Winner: ${winner.name} (${winner.hp} HP remaining)`);
    this.logger.log(`💀 Loser: ${loser.name} (${loser.hp} HP remaining)`);
    this.logger.debug(
      `📈 XP calculation: winner level ${winner.level}, loser level ${loser.level} = ${xpAwarded} XP`,
    );

    const combatLog: DetailedCombatLog = {
      combatId,
      participant1: combatant1.name,
      participant2: combatant2.name,
      initiativeRolls,
      firstAttacker,
      rounds,
      winner: winner.name,
      loser: loser.name,
      xpAwarded,
      goldAwarded,
      timestamp: new Date(),
      location: { x: combatant1.x, y: combatant1.y },
    };

    this.logger.log(
      `💾 Combat log created with ${rounds.length} individual attacks and ${rounds.reduce((sum, round) => sum + round.damage, 0)} total damage`,
    );

    return combatLog;
  }

  // Update HP in database and award XP
  private async applyCombatResults(
    combatLog: DetailedCombatLog,
    combatant1: Combatant,
    combatant2: Combatant,
  ): Promise<void> {
    this.logger.debug(
      `🔄 Applying combat results for combat ${combatLog.combatId}`,
    );

    const winner =
      combatant1.name === combatLog.winner ? combatant1 : combatant2;
    const loser = combatant1.name === combatLog.loser ? combatant1 : combatant2;

    this.logger.debug(
      `Winner: ${winner.name} (${winner.type}, ID: ${winner.id}), Loser: ${loser.name} (${loser.type}, ID: ${loser.id})`,
    );

    // Update loser's HP
    this.logger.debug(`Updating loser ${loser.name} HP to ${loser.hp}...`);
    if (loser.type === 'player') {
      if (!loser.slackId) {
        throw new Error(
          `Player ${loser.name} missing slackId in combat results`,
        );
      }
      await this.playerService.updatePlayerStats(loser.slackId, {
        hp: loser.hp,
      });
      if (!loser.isAlive) {
        this.logger.log(`🏥 Respawning defeated player ${loser.name}`);
        await this.playerService.respawnPlayer(loser.slackId);
      }
    } else {
      if (!loser.isAlive) {
        await this.prisma.monster.delete({ where: { id: loser.id } });
        this.logger.log(
          `🗑️ Removed defeated monster ${loser.name} from the world`,
        );
      } else {
        await this.prisma.monster.update({
          where: { id: loser.id },
          data: { hp: loser.hp, isAlive: loser.isAlive },
        });
        this.logger.debug(
          `Monster ${loser.name} updated: HP=${loser.hp}, alive=${loser.isAlive}`,
        );
      }
    }

    // Award XP to winner if they're a player
    if (winner.type === 'player') {
      if (!winner.slackId) {
        throw new Error(
          `Player ${winner.name} missing slackId in combat results`,
        );
      }
      this.logger.debug(
        `Awarding ${combatLog.xpAwarded} XP to winner ${winner.name}...`,
      );
      const currentPlayer = await this.playerService.getPlayer(winner.slackId);
      const newXp = currentPlayer.xp + combatLog.xpAwarded;
      const goldAwarded = Math.max(0, combatLog.goldAwarded ?? 0);
      const updatedStats: PlayerStatsDto = { xp: newXp };
      let newGoldTotal = currentPlayer.gold;
      if (goldAwarded > 0) {
        newGoldTotal = currentPlayer.gold + goldAwarded;
        updatedStats.gold = newGoldTotal;
      }
      await this.playerService.updatePlayerStats(winner.slackId, updatedStats);
      this.logger.log(
        `📈 ${winner.name} gained ${combatLog.xpAwarded} XP! Total XP: ${currentPlayer.xp} -> ${newXp}`,
      );
      if (goldAwarded > 0) {
        this.logger.log(
          `💰 ${winner.name} gained ${goldAwarded} gold! Total Gold: ${currentPlayer.gold} -> ${newGoldTotal}`,
        );
      }
    } else {
      this.logger.debug(
        `Winner ${winner.name} is a monster, no XP or gold awarded`,
      );
    }

    // Log to database for history
    const totalDamage = combatLog.rounds.reduce(
      (total, round) => total + round.damage,
      0,
    );
    this.logger.debug(
      `Logging combat to database: attacker=${winner.id}, defender=${loser.id}, damage=${totalDamage}`,
    );

    await this.prisma.combatLog.create({
      data: {
        attackerId: winner.id,
        attackerType: winner.type,
        defenderId: loser.id,
        defenderType: loser.type,
        damage: totalDamage,
        x: combatLog.location.x,
        y: combatLog.location.y,
      },
    });

    this.logger.log(`💾 Combat results applied and logged to database`);
  }

  async playerAttackMonster(
    playerSlackId: string,
    monsterId: number,
  ): Promise<CombatResult> {
    this.logger.log(
      `🗡️ Player attack initiated: ${playerSlackId} attacking monster ${monsterId}`,
    );

    const player = await this.playerToCombatant(playerSlackId);
    const monster = await this.monsterToCombatant(monsterId);

    this.logger.debug(
      `Combatants loaded: ${player.name} (${player.hp} HP) vs ${monster.name} (${monster.hp} HP)`,
    );

    if (!player.isAlive) {
      this.logger.warn(`❌ Combat blocked: Player ${player.name} is dead`);
      throw new Error('Player is dead and cannot attack');
    }

    // Check if player and monster are at the same location
    if (player.x !== monster.x || player.y !== monster.y) {
      this.logger.warn(
        `❌ Combat blocked: Location mismatch - Player at (${player.x},${player.y}), Monster at (${monster.x},${monster.y})`,
      );
      throw new Error('Monster is not at your location');
    }

    this.logger.debug(`✅ Pre-combat checks passed, starting combat...`);
    const combatLog = await this.runCombat(player, monster);
    await this.applyCombatResults(combatLog, player, monster);

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === player.name)
      .reduce((total, round) => total + round.damage, 0);

    const aiMessage = await this.generateCombatNarrative(combatLog, {
      secondPersonName: player.name,
    });

    const result = {
      success: true,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === player.name ? combatLog.xpAwarded : 0,
      goldGained:
        combatLog.winner === player.name ? combatLog.goldAwarded : 0,
      message: aiMessage,
    };

    this.logger.log(`✅ Player vs Monster combat completed: ${result.message}`);
    return result;
  }

  async monsterAttackPlayer(
    monsterId: number,
    playerSlackId: string,
  ): Promise<CombatResult> {
    this.logger.log(
      `👹 Monster attack initiated: Monster ${monsterId} attacking player ${playerSlackId}`,
    );

    const monster = await this.monsterToCombatant(monsterId);
    const player = await this.playerToCombatant(playerSlackId);

    this.logger.debug(
      `Combatants loaded: ${monster.name} (${monster.hp} HP) vs ${player.name} (${player.hp} HP)`,
    );

    if (!player.isAlive || !monster.isAlive) {
      this.logger.warn(
        `❌ Combat blocked: Player alive=${player.isAlive}, Monster alive=${monster.isAlive}`,
      );
      throw new Error('Monster or player not found/alive');
    }

    this.logger.debug(`✅ Pre-combat checks passed, starting combat...`);
    const combatLog = await this.runCombat(monster, player);
    await this.applyCombatResults(combatLog, monster, player);

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === monster.name)
      .reduce((total, round) => total + round.damage, 0);

    const aiMessage = await this.generateCombatNarrative(combatLog, {
      secondPersonName: player.name,
    });

    const result = {
      success: true,
      combatLog,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === player.name ? combatLog.xpAwarded : 0,
      goldGained:
        combatLog.winner === player.name ? combatLog.goldAwarded : 0,
      message: aiMessage,
    };

    this.logger.log(`✅ Monster vs Player combat completed: ${result.message}`);
    return result;
  }

  async playerAttackPlayer(
    attackerSlackId: string,
    defenderSlackId: string,
    ignoreLocation = false,
  ): Promise<CombatResult> {
    this.logger.log(
      `⚔️ Player vs Player combat initiated: ${attackerSlackId} attacking ${defenderSlackId}`,
    );

    const attacker = await this.playerToCombatant(attackerSlackId);
    const defender = await this.playerToCombatant(defenderSlackId);

    this.logger.debug(
      `Combatants loaded: ${attacker.name} (${attacker.hp} HP) vs ${defender.name} (${defender.hp} HP)`,
    );

    if (!attacker.isAlive || !defender.isAlive) {
      this.logger.warn(
        `❌ Combat blocked: Attacker alive=${attacker.isAlive}, Defender alive=${defender.isAlive}`,
      );
      throw new Error('One or both players are dead');
    }

    // Check if players are at the same location unless overridden
    if (
      !ignoreLocation &&
      (attacker.x !== defender.x || attacker.y !== defender.y)
    ) {
      this.logger.warn(
        `❌ Combat blocked: Location mismatch - Attacker at (${attacker.x},${attacker.y}), Defender at (${defender.x},${defender.y})`,
      );
      throw new Error('Defender is not at your location');
    }
    if (ignoreLocation) {
      this.logger.debug(
        'Ignoring location check for PvP attack (workspace attack).',
      );
    }

    this.logger.debug(`✅ Pre-combat checks passed, starting PvP combat...`);
    const combatLog = await this.runCombat(attacker, defender);
    await this.applyCombatResults(combatLog, attacker, defender);

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === attacker.name)
      .reduce((total, round) => total + round.damage, 0);

    const aiMessage = await this.generateCombatNarrative(combatLog, {
      secondPersonName: attacker.name,
    });

    const result = {
      success: true,
      combatLog,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === attacker.name ? combatLog.xpAwarded : 0,
      goldGained:
        combatLog.winner === attacker.name ? combatLog.goldAwarded : 0,
      message: aiMessage,
    };

    this.logger.log(`✅ Player vs Player combat completed: ${result.message}`);
    return result;
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
