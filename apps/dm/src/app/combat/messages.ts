import { Logger } from '@nestjs/common';
import type { AiService } from '../../openai/ai.service';
import type { PlayerService } from '../player/player.service';
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

export class CombatMessenger {
  constructor(
    private playerService: PlayerService,
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
  ) {
    const attackerLabel = this.formatPerspectiveName(
      round.attackerName,
      options.secondPersonName,
    );
    const defenderLabel = this.formatPerspectiveName(
      round.defenderName,
      options.secondPersonName,
    );

    // Build detailed attack calculation with equipment bonuses
    let attackCalc = `d20 ${round.attackRoll}`;
    if (round.baseAttackModifier !== undefined) {
      attackCalc += ` ${this.formatModifier(round.baseAttackModifier)}`;
    }
    if (round.attackBonus && round.attackBonus > 0) {
      attackCalc += ` ${this.formatModifier(round.attackBonus)}`;
    }
    attackCalc += ` = ${round.totalAttack}`;

    // Build detailed AC calculation with armor bonuses
    let acCalc = `${round.defenderAC}`;
    if (
      round.baseDefenderAC !== undefined &&
      round.armorBonus !== undefined &&
      round.armorBonus > 0
    ) {
      acCalc = `${round.baseDefenderAC} ${this.formatModifier(round.armorBonus)} = ${round.defenderAC}`;
    }

    const attackLine = `${attackerLabel} attack: ${attackCalc} vs AC ${acCalc} -> ${round.hit ? 'HIT' : 'MISS'}`;

    const defender =
      context.combatantsByName?.get(round.defenderName) ?? undefined;
    const defenderMaxHp =
      typeof defender?.maxHp === 'number' ? defender.maxHp : undefined;
    const hpAfter = round.defenderHpAfter;
    const hpSegment =
      defenderMaxHp !== undefined
        ? `${hpAfter}/${defenderMaxHp}`
        : `${hpAfter}`;

    // Build detailed damage calculation with weapon/equipment bonuses
    let damageLine: string;
    if (round.hit) {
      let damageCalc = `${round.damage}`;
      if (
        round.baseDamage !== undefined &&
        round.damageBonus !== undefined &&
        round.damageBonus > 0
      ) {
        damageCalc = `${round.baseDamage} ${this.formatModifier(round.damageBonus)} = ${round.damage}`;
      }
      damageLine = `Damage: ${damageCalc} -> ${defenderLabel} HP ${hpSegment}${round.killed ? ' KO' : ''}`;
    } else {
      damageLine = `Damage: 0 -> ${defenderLabel} HP ${hpSegment} (miss)`;
    }

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
    return `${combatLog.winner} defeats ${combatLog.loser} in a hard-fought battle.`;
  }

  private buildSummaryBlocks(summary: string): Array<Record<string, unknown>> {
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

  async buildParticipantMessage(
    combatLog: DetailedCombatLog,
    participant: Combatant,
    role: 'attacker' | 'defender',
    context: { attacker: Combatant; defender: Combatant },
  ) {
    if (participant.type !== 'player' || !participant.slackId) return null;
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
    // observersResult.value may be a concrete PlayerEntity[]; convert via
    // unknown first to satisfy TypeScript when narrowing to a loose Record.
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
      // guard runtime types from external playerService responses
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
          blocks: this.buildSummaryBlocks(
            `📣 Combat nearby: ${observerSummary}`,
          ),
        });
      }
    }

    perf.totalMs = Date.now() - start;
    this.logger.debug(
      `Generated ${messages.length} combat messages (${messages.filter((m) => m.role === 'observer').length} observers)`,
    );
    return { messages, perf };
  }
}
