import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  getPrismaClient,
  CombatLog as PrismaCombatLog,
  ItemQuality,
} from '@mud/database';
import type { Item, PlayerItem, ItemQualityType } from '@mud/database';
import {
  MonsterFactory,
  EventBus,
  type CombatInitiateEvent,
  type PlayerRespawnEvent,
} from '@mud/engine';
import { PlayerService } from '../player/player.service';
import { AiService } from '../../openai/ai.service';
import { EventBridgeService } from '../../shared/event-bridge.service';
import type {
  CombatResult,
  CombatRound,
  DetailedCombatLog,
  CombatPerformanceBreakdown,
  CombatMessagePerformance,
} from '../api';
import { AttackOrigin } from '../api/dto/player-requests.dto';
import { runCombat as engineRunCombat } from './engine';
import { CombatMessenger } from './messages';
import {
  applyCombatResults as resultsApplyCombatResults,
  type CombatResultEffects,
} from './results';

const QUALITY_MULTIPLIERS: Record<ItemQualityType, number> = {
  [ItemQuality.Trash]: 0.4,
  [ItemQuality.Poor]: 0.7,
  [ItemQuality.Common]: 1,
  [ItemQuality.Uncommon]: 1.15,
  [ItemQuality.Fine]: 1.25,
  [ItemQuality.Superior]: 1.35,
  [ItemQuality.Rare]: 1.5,
  [ItemQuality.Epic]: 1.7,
  [ItemQuality.Legendary]: 1.9,
  [ItemQuality.Mythic]: 2.1,
  [ItemQuality.Artifact]: 2.4,
  [ItemQuality.Ascended]: 2.7,
  [ItemQuality.Transcendent]: 3,
  [ItemQuality.Primal]: 3.4,
  [ItemQuality.Divine]: 3.8,
};

type EquippedPlayerItem = PlayerItem & { item: Item | null };

type CombatantEquipment = {
  name: string;
  slot?: string | null;
  quality?: ItemQualityType | null;
};

interface CombatNarrative {
  metrics: string;
  rounds: string[];
}

interface NarrativeOptions {
  secondPersonName?: string;
  attackerCombatant?: Combatant;
  defenderCombatant?: Combatant;
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
  levelUp?: {
    previousLevel: number;
    newLevel: number;
    skillPointsAwarded: number;
  };
  attackBonus?: number;
  damageBonus?: number;
  armorBonus?: number;
  equippedItems?: CombatantEquipment[];
}

@Injectable()
export class CombatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CombatService.name);
  private prisma = getPrismaClient();
  private messenger: CombatMessenger;
  private readonly subscriptions: Array<() => void> = [];

  constructor(
    private playerService: PlayerService,
    private aiService: AiService,
    private eventBridge: EventBridgeService,
  ) {}

  // Initialize messenger after DI
  private initMessenger() {
    if (!this.messenger)
      this.messenger = new CombatMessenger(
        this.playerService,
        this.aiService,
        this.logger,
      );
  }

  onModuleInit(): void {
    const unsubscribe = EventBus.on<CombatInitiateEvent>(
      'combat:initiate',
      (event) => this.handleCombatInitiate(event),
    );
    this.subscriptions.push(unsubscribe);
  }

  onModuleDestroy(): void {
    while (this.subscriptions.length > 0) {
      const unsubscribe = this.subscriptions.pop();
      try {
        unsubscribe?.();
      } catch (error) {
        this.logger.error('Failed to remove combat:initiate listener', error);
      }
    }
  }

  private async handleCombatInitiate(
    event: CombatInitiateEvent,
  ): Promise<void> {
    try {
      const options = event.metadata?.ignoreLocation
        ? { ignoreLocation: true }
        : {};
      await this.initiateCombat(
        event.attacker.id,
        event.attacker.type,
        event.defender.id,
        event.defender.type,
        options,
      );
    } catch (error) {
      const source = event.metadata?.source ?? 'unknown-source';
      const reason = event.metadata?.reason
        ? ` reason=${event.metadata.reason}`
        : '';
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process combat:initiate from ${source}${reason}: ${message}`,
      );
    }
  }

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

  private getQualityMultiplier(
    quality: ItemQualityType | null | undefined,
  ): number {
    const key = quality ?? ItemQuality.Common;
    return QUALITY_MULTIPLIERS[key] ?? QUALITY_MULTIPLIERS[ItemQuality.Common];
  }

  private async getEquippedItems(
    playerId: number,
  ): Promise<EquippedPlayerItem[]> {
    if (!this.prisma?.playerItem) {
      return [];
    }
    try {
      return await this.prisma.playerItem.findMany({
        where: { playerId, equipped: true },
        include: { item: true },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to load equipped items for player ${playerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private calculateEquipmentEffects(items: EquippedPlayerItem[]): {
    attackBonus: number;
    damageBonus: number;
    armorBonus: number;
    hpBonus: number;
  } {
    const totals = {
      attackBonus: 0,
      damageBonus: 0,
      armorBonus: 0,
      hpBonus: 0,
    };

    if (!Array.isArray(items) || items.length === 0) {
      return totals;
    }

    const details: Array<{
      playerItemId: number;
      itemId: number | null;
      name: string | null;
      slot: string | undefined | null;
      quality: ItemQualityType | null | undefined;
      multiplier: number;
      base: { attack: number; defense: number; health: number };
      applied: {
        attackBonus: number;
        damageBonus: number;
        armorBonus: number;
        hpBonus: number;
      };
    }> = [];

    for (const record of items) {
      const item = record.item;
      if (!item) continue;

      const multiplier = this.getQualityMultiplier(record.quality);
      const normalizedSlot = ((): string | undefined => {
        if (typeof record.slot === 'string') return record.slot;
        if (typeof item.slot === 'string') return item.slot;
        const type =
          typeof item.type === 'string' ? item.type.toLowerCase() : '';
        if (type === 'weapon') return 'weapon';
        return undefined;
      })();

      const baseAttack = item.attack ?? 0;
      const baseDefense = item.defense ?? 0;
      const baseHealth = item.healthBonus ?? 0;

      const applied = {
        attackBonus: 0,
        damageBonus: 0,
        armorBonus: 0,
        hpBonus: 0,
      };

      if (normalizedSlot === 'weapon' && baseAttack > 0) {
        const scaledAttack = baseAttack * multiplier;
        const scaledToHit = baseAttack * multiplier * 0.5;
        const toHit =
          scaledToHit > 0 ? Math.max(1, Math.round(scaledToHit)) : 0;
        const damage =
          scaledAttack > 0 ? Math.max(1, Math.round(scaledAttack)) : 0;
        if (toHit !== 0) {
          totals.attackBonus += toHit;
          applied.attackBonus = toHit;
        }
        if (damage !== 0) {
          totals.damageBonus += damage;
          applied.damageBonus = damage;
        }
      }

      if (normalizedSlot !== 'weapon' && baseDefense > 0) {
        const defense = Math.round(baseDefense * multiplier);
        if (defense !== 0) {
          totals.armorBonus += defense;
          applied.armorBonus = defense;
        }
      }

      if (baseHealth > 0) {
        const health = Math.round(baseHealth * multiplier);
        if (health !== 0) {
          totals.hpBonus += health;
          applied.hpBonus = health;
        }
      }

      details.push({
        playerItemId: record.id,
        itemId: item.id ?? null,
        name: item.name ?? null,
        slot:
          normalizedSlot ?? (typeof item.slot === 'string' ? item.slot : null),
        quality: record.quality ?? null,
        multiplier: Number(multiplier.toFixed(2)),
        base: { attack: baseAttack, defense: baseDefense, health: baseHealth },
        applied,
      });
    }

    if (details.length > 0) {
      this.logger.debug(
        `Equipment effects summary: ${JSON.stringify({ totals, details })}`,
      );
    }

    return totals;
  }

  private formatCombatNarrative(narrative: CombatNarrative): string {
    const lines = [narrative.metrics.trim()];

    if (narrative.rounds.length) {
      lines.push('');
      narrative.rounds.forEach((round, index) => {
        lines.push(`Round ${index + 1}`);
        round
          .split('\n')
          .map((segment) => segment.trim())
          .filter((segment) => segment.length > 0)
          .forEach((segment) => lines.push(segment));
        if (index !== narrative.rounds.length - 1) {
          lines.push('');
        }
      });
    }

    return lines.join('\n');
  }

  private formatPerspectiveName(
    name: string,
    secondPersonName?: string,
  ): string {
    return secondPersonName && name === secondPersonName ? 'You' : name;
  }

  private formatModifier(value: number): string {
    return value >= 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
  }

  private formatGearList(combatant?: Combatant): string {
    const items = combatant?.equippedItems?.filter((item) => item?.name);
    if (!items || items.length === 0) {
      return 'none';
    }

    return items
      .map((item) => {
        const quality = item.quality ? ` [${item.quality}]` : '';
        return `${item.name}${quality}`;
      })
      .join('; ');
  }

  private formatCombatantMetrics(
    fallbackName: string | undefined,
    combatant: Combatant | undefined,
    secondPersonName?: string,
  ): string {
    const safeName =
      fallbackName && fallbackName.trim().length
        ? fallbackName
        : (combatant?.name ?? 'Unknown');
    const label = this.formatPerspectiveName(safeName, secondPersonName);

    if (!combatant) {
      return label;
    }

    const metrics: string[] = [
      `Lvl ${combatant.level}`,
      `HP ${combatant.hp}/${combatant.maxHp}`,
      `Str ${combatant.strength}`,
      `Agi ${combatant.agility}`,
    ];

    if (combatant.attackBonus && combatant.attackBonus !== 0) {
      metrics.push(`Atk +${combatant.attackBonus}`);
    }
    if (combatant.damageBonus && combatant.damageBonus !== 0) {
      metrics.push(`Dmg +${combatant.damageBonus}`);
    }
    if (combatant.armorBonus && combatant.armorBonus !== 0) {
      metrics.push(`AC +${combatant.armorBonus}`);
    }

    metrics.push(`Gear: ${this.formatGearList(combatant)}`);

    return `${label} (${metrics.join(', ')})`;
  }

  private describeRound(
    round: CombatRound,
    options: NarrativeOptions = {},
    context: { combatantsByName?: Map<string, Combatant> } = {},
  ): string {
    const attackerLabel = this.formatPerspectiveName(
      round.attackerName,
      options.secondPersonName,
    );
    const defenderLabel = this.formatPerspectiveName(
      round.defenderName,
      options.secondPersonName,
    );

    const attackLine = `${attackerLabel} attack: d20 ${round.attackRoll} ${this.formatModifier(
      round.attackModifier,
    )} = ${round.totalAttack} vs AC ${round.defenderAC} -> ${round.hit ? 'HIT' : 'MISS'}`;

    const defender =
      context.combatantsByName?.get(round.defenderName) ?? undefined;
    const defenderMaxHp =
      typeof defender?.maxHp === 'number' ? defender.maxHp : undefined;
    const hpAfter = round.defenderHpAfter;
    const hpSegment =
      defenderMaxHp !== undefined
        ? `${hpAfter}/${defenderMaxHp}`
        : `${hpAfter}`;

    const damageLine = round.hit
      ? `Damage: ${round.damage} -> ${defenderLabel} HP ${hpSegment}${round.killed ? ' KO' : ''}`
      : `Damage: 0 -> ${defenderLabel} HP ${hpSegment} (miss)`;

    return [attackLine, damageLine].join('\n');
  }

  private createFallbackNarrative(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ): CombatNarrative {
    const combatantsByName = new Map<string, Combatant>();
    if (options.attackerCombatant) {
      combatantsByName.set(
        options.attackerCombatant.name,
        options.attackerCombatant,
      );
    }
    if (options.defenderCombatant) {
      combatantsByName.set(
        options.defenderCombatant.name,
        options.defenderCombatant,
      );
    }

    const attackerName =
      combatLog.firstAttacker ||
      combatLog.participant1 ||
      options.attackerCombatant?.name ||
      'Unknown attacker';
    const defenderName =
      attackerName === combatLog.participant1
        ? combatLog.participant2 ||
          options.defenderCombatant?.name ||
          'Unknown defender'
        : combatLog.participant1 ||
          options.defenderCombatant?.name ||
          'Unknown defender';

    const metrics = [
      this.formatCombatantMetrics(
        attackerName,
        combatantsByName.get(attackerName),
        options.secondPersonName,
      ),
      this.formatCombatantMetrics(
        defenderName,
        combatantsByName.get(defenderName),
        options.secondPersonName,
      ),
    ].join(' vs ');

    const rounds = combatLog.rounds.map((round) =>
      this.describeRound(round, options, { combatantsByName }),
    );

    return { metrics, rounds };
  }

  private async generateCombatNarrative(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ): Promise<string> {
    const fallback = this.createFallbackNarrative(combatLog, options);
    return this.formatCombatNarrative(fallback);
  }

  // Generate a short, entertaining summary (2-3 sentences)
  private async generateEntertainingSummary(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ): Promise<string> {
    const roundsCompleted = Math.ceil(combatLog.rounds.length / 2);
    const narrativeVoice = options.secondPersonName
      ? `Speak directly to ${options.secondPersonName} as "you" and keep everyone else in third person.`
      : 'Use third-person narration throughout.';

    const locationLine = combatLog.location
      ? `Location: (${combatLog.location.x}, ${combatLog.location.y}).`
      : 'Location: unknown.';

    const prompt = [
      'Create a punchy, vivid two-sentence summary of a fantasy combat for a Slack message.',
      'Avoid dice jargon and Slack markdown; keep language bold and accessible.',
      narrativeVoice,
      `Result: ${combatLog.winner} defeated ${combatLog.loser} after ${roundsCompleted} rounds.`,
      `Opening move: ${combatLog.firstAttacker}; ${locationLine}`,
    ].join('\n');

    try {
      const ai = await this.aiService.getText(prompt, {
        timeoutMs: 2000,
        maxTokens: 120,
        model: 'gpt-4o-mini',
      });
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
    levelUp?: {
      previousLevel: number;
      newLevel: number;
      skillPointsAwarded: number;
    },
  ): string {
    const rewardText = `${base}\n\nRewards: +${rewards.xp} XP, +${rewards.gold} gold.`;
    if (!levelUp || levelUp.newLevel <= levelUp.previousLevel) {
      return rewardText;
    }

    const skillPointSuffix = levelUp.skillPointsAwarded
      ? ` Awarded +${levelUp.skillPointsAwarded} skill point${
          levelUp.skillPointsAwarded === 1 ? '' : 's'
        }.`
      : '';

    return (
      rewardText +
      `\n🎉 Level up! Reached level ${levelUp.newLevel}.${skillPointSuffix}`
    );
  }

  private async buildParticipantMessage(
    combatLog: DetailedCombatLog,
    participant: Combatant,
    role: 'attacker' | 'defender',
    context: { attacker: Combatant; defender: Combatant },
  ): Promise<CombatMessage | null> {
    if (participant.type !== 'player' || !participant.slackId) {
      return null;
    }

    const options: NarrativeOptions = {
      secondPersonName: participant.name,
      attackerCombatant: context.attacker,
      defenderCombatant: context.defender,
    };
    const [narrative, summary] = await Promise.all([
      this.generateCombatNarrative(combatLog, options),
      this.generateEntertainingSummary(combatLog, options),
    ]);
    const rewards = this.getParticipantRewards(combatLog, participant.name);

    return {
      slackId: participant.slackId,
      name: participant.name,
      message: this.appendRewards(narrative, rewards, participant.levelUp),
      role,
      blocks: this.buildSummaryBlocks(
        this.appendRewards(summary, rewards, participant.levelUp),
      ),
    };
  }

  // Convert Player/Monster to Combatant interface
  private async playerToCombatant(identifier: string): Promise<Combatant> {
    let firstError: unknown;
    let player = await this.playerService.getPlayer(identifier).catch((err) => {
      firstError = err;
      return null;
    });

    if (!player) {
      player = await this.playerService
        .getPlayerByClientId(identifier)
        .catch(() => null);
    }

    if (!player) {
      if (firstError instanceof Error) {
        throw firstError;
      }
      throw new Error('Player not found or not alive');
    }

    const equippedItems = await this.getEquippedItems(player.id);
    const equipmentTotals = this.calculateEquipmentEffects(equippedItems);

    const effectiveMaxHp = player.combat.maxHp + equipmentTotals.hpBonus;
    const effectiveHp = Math.min(
      effectiveMaxHp,
      player.combat.hp + equipmentTotals.hpBonus,
    );

    const combatant: Combatant = {
      id: player.id,
      name: player.name,
      type: 'player' as const,
      hp: effectiveHp,
      maxHp: effectiveMaxHp,
      strength: player.attributes.strength,
      agility: player.attributes.agility,
      level: player.level,
      isAlive: player.combat.isAlive,
      x: player.position.x,
      y: player.position.y,
      slackId: player.clientType === 'slack' ? player.clientId : undefined,
    };

    if (equipmentTotals.attackBonus > 0) {
      combatant.attackBonus = equipmentTotals.attackBonus;
    }
    if (equipmentTotals.damageBonus > 0) {
      combatant.damageBonus = equipmentTotals.damageBonus;
    }
    if (equipmentTotals.armorBonus > 0) {
      combatant.armorBonus = equipmentTotals.armorBonus;
    }

    if (Array.isArray(equippedItems) && equippedItems.length > 0) {
      const itemSummaries = equippedItems
        .filter((record): record is EquippedPlayerItem & { item: Item } => {
          return !!record.item && typeof record.item.name === 'string';
        })
        .map((record) => ({
          name: record.item.name,
          slot:
            typeof record.slot === 'string'
              ? record.slot
              : typeof record.item.slot === 'string'
                ? record.item.slot
                : null,
          quality: (record.quality as ItemQualityType | null) ?? null,
        }));

      if (itemSummaries.length > 0) {
        combatant.equippedItems = itemSummaries;
      }

      this.logger.debug(
        `Equipment bonuses for ${combatant.name}: +${equipmentTotals.attackBonus} atk, +${equipmentTotals.damageBonus} dmg, +${equipmentTotals.armorBonus} AC, +${equipmentTotals.hpBonus} HP (${equippedItems.length} items)`,
      );
    }

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
    // Pass service-level helper functions as overrides so unit tests that spy
    // on service internals (rollD20, calculateXpGain, etc.) continue to work.
    return engineRunCombat(combatant1, combatant2, this.logger, {
      rollD20: this.rollD20.bind(this),
      rollDice: this.rollDice.bind(this),
      getModifier: this.getModifier.bind(this),
      calculateAC: this.calculateAC.bind(this),
      rollInitiative: this.rollInitiative.bind(this),
      calculateDamage: this.calculateDamage.bind(this),
      calculateXpGain: this.calculateXpGain.bind(this),
      calculateGoldReward: this.calculateGoldReward.bind(this),
    });
  }

  // Update HP in database and award XP
  private async applyCombatResults(
    combatLog: DetailedCombatLog,
    combatant1: Combatant,
    combatant2: Combatant,
    options: { attackOrigin?: AttackOrigin } = {},
  ): Promise<CombatResultEffects> {
    return resultsApplyCombatResults(
      combatLog,
      combatant1,
      combatant2,
      this.playerService,
      this.prisma,
      this.logger,
      options,
    );
  }

  /**
   * Generate combat messages for all participants and observers
   */
  private async generateCombatMessages(
    combatLog: DetailedCombatLog,
    attacker: Combatant,
    defender: Combatant,
  ): Promise<{ messages: CombatMessage[]; perf: CombatMessagePerformance }> {
    // Generate participant and observer messages using service-level
    // helpers so unit tests can spy/mock `generateCombatNarrative` and
    // `generateEntertainingSummary` on this service instance.
    const start = Date.now();
    const perf: CombatMessagePerformance = {
      totalMs: 0,
    } as CombatMessagePerformance;
    const messages: CombatMessage[] = [];
    const { x, y } = combatLog.location;

    const measure = async <T>(
      fn: () => Promise<T>,
    ): Promise<{ value: T; duration: number }> => {
      const s = Date.now();
      const value = await fn();
      return { value, duration: Date.now() - s };
    };

    const participantContext = { attacker, defender };

    const attackerPromise = measure(() =>
      this.buildParticipantMessage(
        combatLog,
        attacker,
        'attacker',
        participantContext,
      ),
    );

    const defenderEligible =
      defender.type === 'player' &&
      !!defender.slackId &&
      defender.slackId !== attacker.slackId;
    const defenderPromise = defenderEligible
      ? measure(() =>
          this.buildParticipantMessage(
            combatLog,
            defender,
            'defender',
            participantContext,
          ),
        )
      : undefined;

    const observerLookupPromise = measure(() =>
      this.playerService.getPlayersAtLocation(x, y, {
        excludePlayerId: attacker.type === 'player' ? attacker.id : undefined,
      }),
    );
    const observerNarrativePromise = measure(() =>
      this.generateCombatNarrative(combatLog, {
        attackerCombatant: attacker,
        defenderCombatant: defender,
      }),
    );
    const observerSummaryPromise = measure(() =>
      this.generateEntertainingSummary(combatLog, {}),
    );

    const attackerResult = await attackerPromise;
    const attackerMessage = attackerResult.value;
    if (attackerMessage) {
      perf.attackerMessageMs = attackerResult.duration;
      messages.push(attackerMessage);
    }

    const defenderResult = defenderPromise ? await defenderPromise : undefined;
    const defenderMessage = defenderResult?.value;
    if (defenderMessage) {
      perf.defenderMessageMs = defenderResult.duration;
      messages.push(defenderMessage);
    }

    const observersResult = await observerLookupPromise;
    perf.observerLookupMs = observersResult.duration;
    const observers = observersResult.value as unknown as Array<
      Record<string, unknown>
    >;

    const observerNarrativeResult = await observerNarrativePromise;
    perf.observerNarrativeMs = observerNarrativeResult.duration;
    const observerMessage = observerNarrativeResult.value;

    const observerSummaryResult = await observerSummaryPromise;
    perf.observerSummaryMs = observerSummaryResult.duration;
    const observerSummary = observerSummaryResult.value;

    for (const observer of observers) {
      const obsId = observer.id as number | undefined;
      if (
        defender.type === 'player' &&
        typeof obsId === 'number' &&
        obsId === defender.id
      )
        continue;
      const clientType = observer.clientType as string | undefined;
      const clientId = observer.clientId as string | undefined;
      const observerName = observer.name as string | undefined;
      if (clientType === 'slack' && clientId) {
        messages.push({
          slackId: clientId,
          name: observerName ?? 'Someone',
          message: `📣 Combat nearby: ${observerMessage}`,
          role: 'observer',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📣 Combat nearby: ${observerSummary}`,
              },
            },
            { type: 'actions', elements: [] },
          ],
        });
      }
    }

    perf.totalMs = Date.now() - start;
    this.logger.debug(
      `Generated ${messages.length} combat messages (${messages.filter((m) => m.role === 'observer').length} observers)`,
    );
    return { messages, perf };
  }

  /**
   * Unified combat method - handles all combat scenarios (player vs player, player vs monster, monster vs player)
   */
  async initiateCombat(
    attackerId: string | number,
    attackerType: 'player' | 'monster',
    defenderId: string | number,
    defenderType: 'player' | 'monster',
    options: { ignoreLocation?: boolean; attackOrigin?: AttackOrigin } = {},
  ): Promise<CombatResult> {
    this.logger.log(
      `⚔️ Combat initiated: ${attackerType} ${attackerId} attacking ${defenderType} ${defenderId}`,
    );
    const timingStart = Date.now();
    const perf: CombatPerformanceBreakdown = {
      totalMs: 0,
      loadCombatantsMs: 0,
      validationMs: 0,
      runCombatMs: 0,
      applyResultsMs: 0,
      messagePrepMs: 0,
      notificationMs: 0,
    };

    let attacker!: Combatant;
    let defender!: Combatant;
    let combatLog: DetailedCombatLog | undefined;
    let messagePerf: CombatMessagePerformance | undefined;
    let messages: CombatMessage[] = [];

    try {
      const loadStart = Date.now();
      attacker =
        attackerType === 'player'
          ? await this.playerToCombatant(attackerId as string)
          : await this.monsterToCombatant(attackerId as number);
      defender =
        defenderType === 'player'
          ? await this.playerToCombatant(defenderId as string)
          : await this.monsterToCombatant(defenderId as number);
      perf.loadCombatantsMs = Date.now() - loadStart;

      this.logger.debug(
        `Combatants loaded: ${attacker.name} (${attacker.hp} HP) vs ${defender.name} (${defender.hp} HP)`,
      );

      const validationStart = Date.now();
      if (!attacker.isAlive || !defender.isAlive) {
        this.logger.warn(
          `❌ Combat blocked: Attacker alive=${attacker.isAlive}, Defender alive=${defender.isAlive}`,
        );
        throw new Error('One or both combatants are dead');
      }

      if (!options.ignoreLocation) {
        if (attacker.x !== defender.x || attacker.y !== defender.y) {
          this.logger.warn(
            `❌ Combat blocked: Location mismatch - Attacker at (${attacker.x},${attacker.y}), Defender at (${defender.x},${defender.y})`,
          );
          throw new Error('Target is not at your location');
        }
      }
      perf.validationMs = Date.now() - validationStart;

      this.logger.debug(`✅ Pre-combat checks passed, starting combat...`);

      const combatStart = Date.now();
      combatLog = await this.runCombat(attacker, defender);
      perf.runCombatMs = Date.now() - combatStart;

      const applyStart = Date.now();
      const effects = await this.applyCombatResults(
        combatLog,
        attacker,
        defender,
        { attackOrigin: options.attackOrigin },
      );
      perf.applyResultsMs = Date.now() - applyStart;

      const { messages: generatedMessages, perf: generatedPerf } =
        await this.generateCombatMessages(combatLog, attacker, defender);
      messages = generatedMessages;
      messagePerf = generatedPerf;
      perf.messagePrepMs = generatedPerf.totalMs;

      const winner = attacker.name === combatLog.winner ? attacker : defender;
      const loser = attacker.name === combatLog.loser ? attacker : defender;

      let notificationElapsed = 0;
      try {
        const notificationStart = Date.now();
        await this.eventBridge.publishCombatNotifications(
          {
            eventType: 'combat:end',
            winner: { type: winner.type, id: winner.id, name: winner.name },
            loser: { type: loser.type, id: loser.id, name: loser.name },
            xpGained: combatLog.xpAwarded,
            goldGained: combatLog.goldAwarded,
            x: combatLog.location.x,
            y: combatLog.location.y,
            timestamp: new Date(),
          },
          messages,
        );
        notificationElapsed = Date.now() - notificationStart;
      } finally {
        perf.notificationMs = notificationElapsed;
        await this.dispatchRespawnEvents(effects.playerRespawnEvents);
      }

      perf.totalMs = Date.now() - timingStart;

      const totalDamage = combatLog.rounds
        .filter((round) => round.attackerName === attacker.name)
        .reduce((total, round) => total + round.damage, 0);

      const breakdown: CombatPerformanceBreakdown = {
        ...perf,
        ...(messagePerf ? { messageDetails: messagePerf } : {}),
      };

      const result: CombatResult = {
        success: true,
        winnerName: combatLog.winner,
        loserName: combatLog.loser,
        totalDamageDealt: totalDamage,
        roundsCompleted: Math.ceil(combatLog.rounds.length / 2),
        xpGained: combatLog.winner === attacker.name ? combatLog.xpAwarded : 0,
        goldGained:
          combatLog.winner === attacker.name ? combatLog.goldAwarded : 0,
        // Keep legacy behavior for callers/tests that expect a short summary
        // in `result.message`. Prefer the participant's narrative message
        // (which tests commonly mock), falling back to the short summary
        // stored in the first message's blocks when the narrative isn't
        // available.
        message: (() => {
          const first = messages[0];
          if (!first) return '';
          if (first.message) return first.message;
          try {
            const blocks = first.blocks as
              | Array<Record<string, unknown>>
              | undefined;
            if (blocks && blocks.length) {
              const section = blocks.find((b) => {
                const maybeText = b.text as Record<string, unknown> | undefined;
                return (
                  typeof b.type === 'string' &&
                  typeof maybeText?.text === 'string'
                );
              });
              if (section) {
                const textObj = section.text as { text?: unknown } | undefined;
                if (textObj && typeof textObj.text === 'string') {
                  return String(textObj.text);
                }
              }
            }
          } catch (err) {
            // ignore and fallthrough to empty
            this.logger.debug('Error extracting summary text', err);
          }
          return '';
        })(),
        playerMessages: messages,
        perfBreakdown: breakdown,
      };

      this.logger.log(
        `✅ Combat completed: ${attacker.name} vs ${defender.name} - Winner: ${result.winnerName}`,
      );
      this.logger.log(
        JSON.stringify({
          event: 'combat.perf',
          success: true,
          attackerType,
          attackerId,
          defenderType,
          defenderId,
          combatId: combatLog.combatId,
          totalMs: breakdown.totalMs,
          loadCombatantsMs: breakdown.loadCombatantsMs,
          validationMs: breakdown.validationMs,
          runCombatMs: breakdown.runCombatMs,
          applyResultsMs: breakdown.applyResultsMs,
          messagePrepMs: breakdown.messagePrepMs,
          notificationMs: breakdown.notificationMs,
          messageDetails: breakdown.messageDetails,
          attackOrigin: options.attackOrigin,
        }),
      );

      return result;
    } catch (error) {
      perf.totalMs = Date.now() - timingStart;
      this.logger.log(
        JSON.stringify({
          event: 'combat.perf',
          success: false,
          attackerType,
          attackerId,
          defenderType,
          defenderId,
          combatId: combatLog?.combatId,
          totalMs: perf.totalMs,
          loadCombatantsMs: perf.loadCombatantsMs,
          validationMs: perf.validationMs,
          runCombatMs: perf.runCombatMs,
          applyResultsMs: perf.applyResultsMs,
          messagePrepMs: perf.messagePrepMs,
          notificationMs: perf.notificationMs,
          error: error instanceof Error ? error.message : String(error),
          attackOrigin: options.attackOrigin,
        }),
      );
      throw error;
    }
  }

  /**
   * Player attacks monster (wrapper for initiateCombat)
   */
  async playerAttackMonster(
    playerSlackId: string,
    monsterId: number,
    options: { attackOrigin?: AttackOrigin } = {},
  ): Promise<CombatResult> {
    const attackOrigin = options.attackOrigin ?? AttackOrigin.TEXT_PVE;
    return this.initiateCombat(playerSlackId, 'player', monsterId, 'monster', {
      attackOrigin,
    });
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

  private async dispatchRespawnEvents(
    events: PlayerRespawnEvent[],
  ): Promise<void> {
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }
    for (const event of events) {
      try {
        await EventBus.emit(event);
      } catch (err) {
        this.logger.warn('Failed to emit deferred respawn event', err);
      }
    }
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
    options: { attackOrigin?: AttackOrigin } = {},
  ): Promise<CombatResult> {
    const attackOrigin = options.attackOrigin ?? AttackOrigin.TEXT_PVP;
    return this.initiateCombat(
      attackerSlackId,
      'player',
      defenderSlackId,
      'player',
      { ignoreLocation, attackOrigin },
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
