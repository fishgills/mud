import { Logger } from '@nestjs/common';
import type { AiService } from '../../openai/ai.service';
import type {
  DetailedCombatLog,
  CombatMessagePerformance,
  CombatRound,
} from '../api';
import type {
  Combatant,
  CombatMessage,
  CombatNarrative,
  NarrativeOptions,
} from './types';
import {
  calculateAttackRating,
  calculateDefenseRating,
  toEffectiveStats,
} from './engine';

export class CombatMessenger {
  constructor(
    private aiService: AiService,
    private logger: Logger,
  ) {}

  private formatCombatNarrative(narrative: CombatNarrative) {
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

  private formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  private formatRatingMath(
    attacker?: Combatant,
    defender?: Combatant,
  ): string | null {
    if (!attacker || !defender) return null;
    const attackerStats = toEffectiveStats(attacker);
    const defenderStats = toEffectiveStats(defender);
    const attackRating = calculateAttackRating(attackerStats);
    const defenseRating = calculateDefenseRating(defenderStats);
    return [
      `AR math: 10*S'(${this.formatNumber(attackerStats.strength)})`,
      `+ 4*A'(${this.formatNumber(attackerStats.agility)})`,
      `+ 6*L'(${this.formatNumber(attackerStats.level)})`,
      `= ${this.formatNumber(attackRating)}`,
      `| DR math: 10*A'(${this.formatNumber(defenderStats.agility)})`,
      `+ 2*H'(${this.formatNumber(defenderStats.health)})`,
      `+ 6*L'(${this.formatNumber(defenderStats.level)})`,
      `= ${this.formatNumber(defenseRating)}`,
    ].join(' ');
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
      `Vit ${combatant.health}`,
    ];

    if (combatant.damageRoll) {
      metrics.push(`Weapon ${combatant.damageRoll}`);
    }

    metrics.push(`Gear: ${this.formatGearList(combatant)}`);

    return `${label} (${metrics.join(', ')})`;
  }

  private describeRound(
    round: CombatRound,
    options: NarrativeOptions = {},
    context: { combatantsByName?: Map<string, Combatant> } = {},
  ) {
    const attackerLabel = this.formatPerspectiveName(
      round.attackerName,
      options.secondPersonName,
    );
    const defenderLabel = this.formatPerspectiveName(
      round.defenderName,
      options.secondPersonName,
    );

    const attackLine = `${attackerLabel} strike: AR ${this.formatNumber(round.attackRating)} vs DR ${this.formatNumber(round.defenseRating)} (hit ${this.formatPercent(round.hitChance)}) -> ${round.hit ? 'HIT' : 'MISS'}`;
    const attacker =
      context.combatantsByName?.get(round.attackerName) ?? undefined;
    const defender =
      context.combatantsByName?.get(round.defenderName) ?? undefined;
    const ratingMath = this.formatRatingMath(attacker, defender);

    const defenderMaxHp =
      typeof defender?.maxHp === 'number' ? defender.maxHp : undefined;
    const hpAfter = round.defenderHpAfter;
    const hpSegment =
      defenderMaxHp !== undefined
        ? `${hpAfter}/${defenderMaxHp}`
        : `${hpAfter}`;

    let damageLine: string;
    if (round.hit) {
      const weaponSegment =
        round.weaponDamage > 0 ? ` + weapon ${round.weaponDamage}` : '';
      const critSegment = round.crit
        ? `, crit x${round.critMultiplier ?? 1.5}`
        : '';
      const breakdown = `core ${this.formatNumber(round.coreDamage)}${weaponSegment}, mit ${this.formatPercent(round.mitigation)}${critSegment}`;
      damageLine = `Damage: ${round.damage} (${breakdown}) -> ${defenderLabel} HP ${hpSegment}${round.killed ? ' KO' : ''}`;
    } else {
      damageLine = `Damage: 0 -> ${defenderLabel} HP ${hpSegment} (miss)`;
    }

    const lines = [attackLine];
    if (ratingMath) {
      lines.push(ratingMath);
    }
    lines.push(damageLine);
    return lines.join('\n');
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

  async generateCombatNarrative(
    combatLog: DetailedCombatLog,
    options: NarrativeOptions = {},
  ) {
    const fallback = this.createFallbackNarrative(combatLog, options);
    return this.formatCombatNarrative(fallback);
  }

  async generateEntertainingSummary(
    combatLog: DetailedCombatLog,
    options: { secondPersonName?: string } = {},
  ) {
    const roundsCompleted = Math.ceil(combatLog.rounds.length / 2);
    const narrativeVoice = options.secondPersonName
      ? `Speak directly to ${options.secondPersonName} as "you" and keep everyone else in third person.`
      : 'Use third-person narration throughout.';
    const prompt = [
      'Create a punchy, vivid two-sentence summary of a fantasy combat for a Slack message.',
      'Avoid dice jargon and Slack markdown; keep language bold and accessible.',
      narrativeVoice,
      `Result: ${combatLog.winner} defeated ${combatLog.loser} after ${roundsCompleted} rounds.`,
      `Opening move: ${combatLog.firstAttacker}.`,
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
    return `${combatLog.winner} defeats ${combatLog.loser} in a hard-fought battle.`;
  }

  private buildSummaryBlocks(
    summary: string,
    combatId?: string,
  ): Array<Record<string, unknown>> {
    return [
      { type: 'section', text: { type: 'mrkdwn', text: summary } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'combat_action_show_log',
            text: { type: 'plain_text', text: 'View full combat log' },
            style: 'primary',
            ...(combatId ? { value: combatId } : {}),
          },
        ],
      },
    ];
  }

  private getParticipantRewards(
    combatLog: DetailedCombatLog,
    participantName: string,
  ) {
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
  ) {
    const rewardText = `${base}\n\nRewards: +${rewards.xp} XP, +${rewards.gold} gold.`;
    if (!levelUp || levelUp.newLevel <= levelUp.previousLevel)
      return rewardText;
    const skillPointSuffix = levelUp.skillPointsAwarded
      ? ` Awarded +${levelUp.skillPointsAwarded} skill point${levelUp.skillPointsAwarded === 1 ? '' : 's'}.`
      : '';
    return (
      rewardText +
      `\n🎉 Level up! Reached level ${levelUp.newLevel}.${skillPointSuffix}`
    );
  }

  private getDefeatPrefixes(
    combatLog: DetailedCombatLog,
    participantName: string,
  ) {
    if (combatLog.winner === participantName) {
      return { narrative: '', summary: '' };
    }

    const winner = combatLog.winner || 'your foe';
    return {
      narrative: `You were defeated by ${winner}.\n\n`,
      summary: `*Defeat.* ${winner} brings you down.\n`,
    };
  }

  async buildParticipantMessage(
    combatLog: DetailedCombatLog,
    participant: Combatant,
    role: 'attacker' | 'defender',
    context: { attacker: Combatant; defender: Combatant },
  ): Promise<CombatMessage | null> {
    if (participant.type !== 'player' || !participant.slackUser?.teamId)
      return null;
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
    const defeatPrefixes = this.getDefeatPrefixes(combatLog, participant.name);
    return {
      teamId: participant.slackUser.teamId!,
      userId: participant.slackUser.userId!,
      name: participant.name,
      message: this.appendRewards(
        `${defeatPrefixes.narrative}${narrative}`,
        rewards,
        participant.levelUp,
      ),
      role,
      blocks: this.buildSummaryBlocks(
        this.appendRewards(
          `${defeatPrefixes.summary}${summary}`,
          rewards,
          participant.levelUp,
        ),
        combatLog.combatId,
      ),
    } as CombatMessage;
  }

  async generateCombatMessages(
    combatLog: DetailedCombatLog,
    attacker: Combatant,
    defender: Combatant,
  ): Promise<{ messages: CombatMessage[]; perf: CombatMessagePerformance }> {
    const start = Date.now();
    const perf: CombatMessagePerformance = {
      totalMs: 0,
    } as CombatMessagePerformance;
    const messages: CombatMessage[] = [];

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
      !!defender.slackUser?.userId &&
      defender.slackUser.userId !== attacker.slackUser?.userId;
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

    perf.totalMs = Date.now() - start;
    this.logger.debug(`Generated ${messages.length} combat messages`);
    return { messages, perf };
  }
}
