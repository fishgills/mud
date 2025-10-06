import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient, CombatLog as PrismaCombatLog } from '@mud/database';
import { MonsterFactory, EventBus } from '@mud/engine';
import { PlayerService } from '../player/player.service';
import { PlayerStatsDto } from '../player/dto/player.dto';
import { AiService } from '../../openai/ai.service';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { CombatResult, CombatRound, DetailedCombatLog } from '../graphql';

interface CombatNarrative {
  summary: string;
  rounds: string[];
}

interface NarrativeOptions {
  secondPersonName?: string;
}

export interface CombatMessage {
  slackId: string;
  name: string;
  message: string;
  role: 'attacker' | 'defender' | 'observer';
  // Optional rich message payload for Slack (Block Kit-like structure)
  blocks?: Array<Record<string, unknown>>;
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
    private eventBridge: EventBridgeService,
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

  // Calculate XP gain based on opponent difficulty and level difference
  // Goals:
  // - Reasonable base XP at low levels (≈25–35 for equal levels)
  // - More XP for defeating higher-level foes, less for lower-level
  // - Naturally discourage high-level farming of level-1 monsters
  private calculateXpGain(winnerLevel: number, loserLevel: number): number {
    // Base scales modestly with opponent level; add small variability
    const base = 20 + 5 * Math.max(1, loserLevel);
    const variability = this.rollDice(2, 6) - 2; // 0–10 swing

    // Positive when opponent is higher level, negative when lower
    const levelDiff = loserLevel - winnerLevel;
    let multiplier: number;
    if (levelDiff >= 0) {
      // Reward upsets: +20% per level difference, capped at +200%
      multiplier = 1 + Math.min(2, levelDiff * 0.2);
    } else {
      // Penalize bullying: -10% per level, floored at 0.25x
      multiplier = Math.max(0.25, 1 + levelDiff * 0.1);
    }

    const rawXp = (base + variability) * multiplier;
    const finalXp = Math.max(5, Math.floor(rawXp));
    this.logger.debug(
      `XP calc: base ~${base}+${variability}, diff=${levelDiff}, mult=${multiplier.toFixed(2)} => ${finalXp}`,
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
      'Respond with a engaging 2 or 3 sentence summary followed by a concise round-by-round log.',
      instructions,
      'Use only facts from the combat data. Keep language vivid but concise and avoid dice roll jargon.',
      'Combat data:',
      JSON.stringify(context, null, 2),
    ].join('\n');

    this.logger.debug(`Combat narrative AI prompt: ${prompt}`);

    try {
      const ai = await this.aiService.getText(prompt, {
        timeoutMs: 20000,
      });

      const rawText = (ai?.output_text ?? '').trim();
      if (rawText) {
        this.logger.debug(`AI combat narrative generated: ${rawText}`);
        const cleaned = rawText
          .replace(/^```(json)?\s*/i, '')
          .replace(/```$/i, '')
          .trim();

        if (cleaned) {
          return cleaned;
        }
        this.logger.debug(
          'AI combat narrative response was empty after cleaning, using fallback.',
        );
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

  // Generate a short, entertaining summary (2-3 sentences)
  private async generateEntertainingSummary(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ): Promise<string> {
    const instructions = options.secondPersonName
      ? `Write in second person addressing "${options.secondPersonName}" as "you"; refer to others by name.`
      : 'Use concise third-person narration.';

    const prompt = [
      'Create a punchy, fun 2–3 sentence summary of a fantasy combat.',
      'Avoid numbers, dice jargon, or Slack markdown. Keep it vivid and readable.',
      instructions,
      'Combat data:',
      JSON.stringify(
        {
          participants: [combatLog.participant1, combatLog.participant2],
          winner: combatLog.winner,
          loser: combatLog.loser,
          roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
          firstAttacker: combatLog.firstAttacker,
          location: combatLog.location,
        },
        null,
        2,
      ),
    ].join('\n');

    try {
      const ai = await this.aiService.getText(prompt, { timeoutMs: 2000 });
      const text = (ai?.output_text || '').trim();
      if (text) return text;
    } catch {
      // fallthrough
    }
    // Fallback: basic deterministic line
    return `${combatLog.winner} defeats ${combatLog.loser} in a hard-fought battle.`;
  }

  private buildSummaryBlocks(summary: string): Array<Record<string, unknown>> {
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: summary },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'combat_action_show_log',
            text: { type: 'plain_text', text: 'View full combat log' },
            style: 'primary',
          },
        ],
      },
    ];
  }

  private getParticipantRewards(
    combatLog: DetailedCombatLog,
    participantName: string,
  ): { xp: number; gold: number } {
    const isWinner = combatLog.winner === participantName;
    return {
      xp: isWinner ? combatLog.xpAwarded : 0,
      gold: isWinner ? combatLog.goldAwarded : 0,
    };
  }

  private appendRewards(
    base: string,
    rewards: { xp: number; gold: number },
  ): string {
    return `${base}\n\nRewards: +${rewards.xp} XP, +${rewards.gold} gold.`;
  }

  private async buildParticipantMessage(
    combatLog: DetailedCombatLog,
    participant: Combatant,
    role: 'attacker' | 'defender',
  ): Promise<CombatMessage | null> {
    if (participant.type !== 'player' || !participant.slackId) {
      return null;
    }

    const options = { secondPersonName: participant.name };
    const [narrative, summary] = await Promise.all([
      this.generateCombatNarrative(combatLog, options),
      this.generateEntertainingSummary(combatLog, options),
    ]);
    const rewards = this.getParticipantRewards(combatLog, participant.name);

    return {
      slackId: participant.slackId,
      name: participant.name,
      message: this.appendRewards(narrative, rewards),
      role,
      blocks: this.buildSummaryBlocks(this.appendRewards(summary, rewards)),
    };
  }

  // Convert Player/Monster to Combatant interface
  private async playerToCombatant(slackId: string): Promise<Combatant> {
    const player = await this.playerService.getPlayer(slackId);
    const combatant = {
      id: player.id,
      name: player.name,
      type: 'player' as const,
      hp: player.combat.hp,
      maxHp: player.combat.maxHp,
      strength: player.attributes.strength,
      agility: player.attributes.agility,
      level: player.level,
      isAlive: player.combat.isAlive,
      x: player.position.x,
      y: player.position.y,
      slackId: slackId, // Store the Slack ID for later use
    };
    this.logger.debug(
      `Player combatant: ${combatant.name} (Str:${combatant.strength}, Agi:${combatant.agility}, HP:${combatant.hp}/${combatant.maxHp}, Lvl:${combatant.level})`,
    );
    return combatant;
  }

  private async monsterToCombatant(monsterId: number): Promise<Combatant> {
    const monster = await MonsterFactory.load(monsterId);
    if (!monster || !monster.combat.isAlive) {
      throw new Error('Monster not found or already dead');
    }
    const combatant = {
      id: monster.id,
      name: monster.name,
      type: 'monster' as const,
      hp: monster.combat.hp,
      maxHp: monster.combat.maxHp,
      strength: monster.attributes.strength,
      agility: monster.attributes.agility,
      level: 1, // Default to level 1 for monsters
      isAlive: monster.combat.isAlive,
      x: monster.position.x,
      y: monster.position.y,
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

    // Emit combat start event
    await EventBus.emit({
      eventType: 'combat:start',
      attacker: { type: combatant1.type, id: combatant1.id },
      defender: { type: combatant2.type, id: combatant2.id },
      x: combatant1.x,
      y: combatant1.y,
      timestamp: new Date(),
    });

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

      // Emit combat hit or miss event
      if (hit) {
        await EventBus.emit({
          eventType: 'combat:hit',
          attacker: {
            type: attacker.type,
            id: attacker.id,
            name: attacker.name,
          },
          defender: {
            type: defender.type,
            id: defender.id,
            name: defender.name,
          },
          damage,
          x: attacker.x,
          y: attacker.y,
          timestamp: new Date(),
        });
      } else {
        await EventBus.emit({
          eventType: 'combat:miss',
          attacker: {
            type: attacker.type,
            id: attacker.id,
            name: attacker.name,
          },
          defender: {
            type: defender.type,
            id: defender.id,
            name: defender.name,
          },
          timestamp: new Date(),
        });
      }

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
    const xpAwarded = this.calculateXpGain(winner.level, loser.level);
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

    // Emit combat end event
    await EventBus.emit({
      eventType: 'combat:end',
      winner: { type: winner.type, id: winner.id },
      loser: { type: loser.type, id: loser.id },
      xpGained: xpAwarded,
      goldGained: goldAwarded,
      timestamp: new Date(),
    });

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
        await MonsterFactory.delete(loser.id);
        this.logger.log(
          `🗑️ Removed defeated monster ${loser.name} from the world`,
        );
      } else {
        const monsterEntity = await MonsterFactory.load(loser.id);
        if (monsterEntity) {
          monsterEntity.combat.hp = loser.hp;
          monsterEntity.combat.isAlive = loser.isAlive;
          await MonsterFactory.save(monsterEntity);
          this.logger.debug(
            `Monster ${loser.name} updated: HP=${loser.hp}, alive=${loser.isAlive}`,
          );
        }
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

  /**
   * Generate combat messages for all participants and observers
   */
  private async generateCombatMessages(
    combatLog: DetailedCombatLog,
    attacker: Combatant,
    defender: Combatant,
  ): Promise<CombatMessage[]> {
    const messages: CombatMessage[] = [];
    const { x, y } = combatLog.location;

    // Generate personalized messages for attacker (if player)
    const attackerMessage = await this.buildParticipantMessage(
      combatLog,
      attacker,
      'attacker',
    );
    if (attackerMessage) {
      messages.push(attackerMessage);
    }

    // Generate personalized messages for defender (if player and different from attacker)
    if (
      defender.type === 'player' &&
      defender.slackId &&
      defender.slackId !== attacker.slackId
    ) {
      const defenderMessage = await this.buildParticipantMessage(
        combatLog,
        defender,
        'defender',
      );
      if (defenderMessage) {
        messages.push(defenderMessage);
      }
    }

    // Get observers at the same location
    const observers = await this.playerService.getPlayersAtLocation(x, y, {
      excludePlayerId: attacker.type === 'player' ? attacker.id : undefined,
    });

    // Generate third-person narrative for observers
    const observerMessage = await this.generateCombatNarrative(combatLog, {});
    const observerSummary = await this.generateEntertainingSummary(
      combatLog,
      {},
    );

    for (const observer of observers) {
      // Skip if observer is the defender (already has personalized message)
      if (defender.type === 'player' && observer.id === defender.id) {
        continue;
      }

      // Extract slackId from clientId (format: "slack:U123456")
      if (observer.clientId && observer.clientId.startsWith('slack:')) {
        const slackId = observer.clientId.replace('slack:', '');
        messages.push({
          slackId,
          name: observer.name,
          message: `📣 Combat nearby: ${observerMessage}`,
          role: 'observer',
          blocks: this.buildSummaryBlocks(
            `📣 Combat nearby: ${observerSummary}`,
          ),
        });
      }
    }

    this.logger.debug(
      `Generated ${messages.length} combat messages (${messages.filter((m) => m.role === 'observer').length} observers)`,
    );
    return messages;
  }

  /**
   * Unified combat method - handles all combat scenarios (player vs player, player vs monster, monster vs player)
   */
  async initiateCombat(
    attackerId: string | number,
    attackerType: 'player' | 'monster',
    defenderId: string | number,
    defenderType: 'player' | 'monster',
    options: { ignoreLocation?: boolean } = {},
  ): Promise<CombatResult> {
    this.logger.log(
      `⚔️ Combat initiated: ${attackerType} ${attackerId} attacking ${defenderType} ${defenderId}`,
    );

    // Load combatants
    const attacker =
      attackerType === 'player'
        ? await this.playerToCombatant(attackerId as string)
        : await this.monsterToCombatant(attackerId as number);

    const defender =
      defenderType === 'player'
        ? await this.playerToCombatant(defenderId as string)
        : await this.monsterToCombatant(defenderId as number);

    this.logger.debug(
      `Combatants loaded: ${attacker.name} (${attacker.hp} HP) vs ${defender.name} (${defender.hp} HP)`,
    );

    // Validate combatants are alive
    if (!attacker.isAlive || !defender.isAlive) {
      this.logger.warn(
        `❌ Combat blocked: Attacker alive=${attacker.isAlive}, Defender alive=${defender.isAlive}`,
      );
      throw new Error('One or both combatants are dead');
    }

    // Check location unless overridden
    if (!options.ignoreLocation) {
      if (attacker.x !== defender.x || attacker.y !== defender.y) {
        this.logger.warn(
          `❌ Combat blocked: Location mismatch - Attacker at (${attacker.x},${attacker.y}), Defender at (${defender.x},${defender.y})`,
        );
        throw new Error('Target is not at your location');
      }
    }

    this.logger.debug(`✅ Pre-combat checks passed, starting combat...`);
    const combatLog = await this.runCombat(attacker, defender);
    await this.applyCombatResults(combatLog, attacker, defender);

    // Generate messages for all participants and observers
    const messages = await this.generateCombatMessages(
      combatLog,
      attacker,
      defender,
    );

    // Publish combat notifications to clients via Redis
    const winner = attacker.name === combatLog.winner ? attacker : defender;
    const loser = attacker.name === combatLog.loser ? attacker : defender;

    await this.eventBridge.publishCombatNotifications(
      {
        eventType: 'combat:end',
        winner: { type: winner.type, id: winner.id },
        loser: { type: loser.type, id: loser.id },
        xpGained: combatLog.xpAwarded,
        goldGained: combatLog.goldAwarded,
        timestamp: new Date(),
      },
      messages,
    );

    const totalDamage = combatLog.rounds
      .filter((round) => round.attackerName === attacker.name)
      .reduce((total, round) => total + round.damage, 0);

    const result: CombatResult = {
      success: true,
      winnerName: combatLog.winner,
      loserName: combatLog.loser,
      totalDamageDealt: totalDamage,
      roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
      xpGained: combatLog.winner === attacker.name ? combatLog.xpAwarded : 0,
      goldGained:
        combatLog.winner === attacker.name ? combatLog.goldAwarded : 0,
      message: messages[0]?.message || '',
      playerMessages: messages,
    };

    this.logger.log(
      `✅ Combat completed: ${attacker.name} vs ${defender.name} - Winner: ${result.winnerName}`,
    );
    return result;
  }

  /**
   * Player attacks monster (wrapper for initiateCombat)
   */
  async playerAttackMonster(
    playerSlackId: string,
    monsterId: number,
  ): Promise<CombatResult> {
    return this.initiateCombat(playerSlackId, 'player', monsterId, 'monster');
  }

  /**
   * Monster attacks player (wrapper for initiateCombat)
   */
  /**
   * Monster attacks player (wrapper for initiateCombat)
   */
  async monsterAttackPlayer(
    monsterId: number,
    playerSlackId: string,
  ): Promise<CombatResult> {
    return this.initiateCombat(monsterId, 'monster', playerSlackId, 'player');
  }

  /**
   * Player attacks player (wrapper for initiateCombat)
   */
  /**
   * Player attacks player (wrapper for initiateCombat)
   */
  async playerAttackPlayer(
    attackerSlackId: string,
    defenderSlackId: string,
    ignoreLocation = false,
  ): Promise<CombatResult> {
    return this.initiateCombat(
      attackerSlackId,
      'player',
      defenderSlackId,
      'player',
      { ignoreLocation },
    );
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
