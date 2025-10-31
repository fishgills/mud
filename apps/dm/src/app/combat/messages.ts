import { Logger } from '@nestjs/common';
import type { AiService } from '../../openai/ai.service';
import type { PlayerService } from '../player/player.service';
import type {
  DetailedCombatLog,
  CombatMessagePerformance,
  CombatRound,
} from '../api';
import type { Combatant, CombatMessage } from './types';

export class CombatMessenger {
  constructor(
    private playerService: PlayerService,
    private aiService: AiService,
    private logger: Logger,
  ) {}

  private formatCombatNarrative(narrative: {
    summary: string;
    rounds: string[];
  }) {
    const lines = ['**Combat Summary:**', narrative.summary.trim()];
    if (narrative.rounds.length) {
      lines.push('', '**Combat Log:**');
      narrative.rounds.forEach((line, index) =>
        lines.push(`Round ${index + 1}: ${line.trim()}`),
      );
    }
    return lines.join('\n');
  }

  private describeRound(
    round: CombatRound,
    options: { secondPersonName?: string } = {},
  ) {
    const { secondPersonName } = options;
    const attackerIsYou = secondPersonName === round.attackerName;
    const defenderIsYou = secondPersonName === round.defenderName;
    const formatModifier = (value: number) =>
      value >= 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
    const attackDetails = `Attack: d20 ${round.attackRoll} ${formatModifier(round.attackModifier)} = ${round.totalAttack} vs AC ${round.defenderAC} (${round.hit ? 'HIT' : 'MISS'})`;
    const damageDetails = round.hit
      ? `Damage: ${round.damage}${round.killed ? ' (defeated)' : ''}`
      : null;
    const mathDetails = damageDetails
      ? `${attackDetails}; ${damageDetails}`
      : attackDetails;
    if (round.hit) {
      if (attackerIsYou)
        return `You strike ${round.defenderName} for ${round.damage} damage${round.killed ? ', defeating them!' : '!'} _(${mathDetails})_`;
      if (defenderIsYou)
        return `${round.attackerName} hits you for ${round.damage} damage${round.killed ? ', leaving you defeated!' : '!'} _(${mathDetails})_`;
      return `${round.attackerName} hits ${round.defenderName} for ${round.damage} damage${round.killed ? ', slaying them!' : '!'} _(${mathDetails})_`;
    }
    if (attackerIsYou)
      return `You swing at ${round.defenderName} but miss. _(${mathDetails})_`;
    if (defenderIsYou)
      return `${round.attackerName} swings at you but misses. _(${mathDetails})_`;
    return `${round.attackerName} swings at ${round.defenderName} but misses. _(${mathDetails})_`;
  }

  private createFallbackNarrative(
    combatLog: DetailedCombatLog,
    options: { secondPersonName?: string } = {},
  ) {
    const summary = `${combatLog.winner} defeats ${combatLog.loser} after ${Math.ceil(combatLog.rounds.length / 2)} rounds of combat.`;
    const rounds = combatLog.rounds.map((r) => this.describeRound(r, options));
    return { summary, rounds };
  }

  async generateCombatNarrative(
    combatLog: DetailedCombatLog,
    options: { secondPersonName?: string } = {},
  ) {
    const totalRounds = Math.ceil(combatLog.rounds.length / 2);
    const totalDamage = combatLog.rounds.reduce(
      (sum, round) => sum + round.damage,
      0,
    );
    const maxDetailedRounds = 10;
    const roundSummaries = combatLog.rounds
      .slice(0, maxDetailedRounds)
      .map(
        (round) =>
          `${round.roundNumber}: ${round.attackerName} ${round.hit ? `hit ${round.defenderName} for ${round.damage}` : `missed ${round.defenderName}`}${round.killed ? ' (final blow)' : ''}`,
      )
      .join(' | ');
    const roundOverflow =
      combatLog.rounds.length > maxDetailedRounds ? ' | …' : '';
    const roundBreakdownLine = combatLog.rounds.length
      ? `Round breakdown: ${roundSummaries}${roundOverflow || ''}`
      : 'Round breakdown: no exchanges recorded.';
    const locationLine = combatLog.location
      ? `Location: (${combatLog.location.x}, ${combatLog.location.y})`
      : 'Location: unknown';
    const perspectiveInstruction = options.secondPersonName
      ? `Refer to ${options.secondPersonName} as "you" while keeping opponents in third person.`
      : 'Use third-person narration for everyone.';

    const prompt = [
      'You are a fantasy combat narrator crafting Slack-ready copy.',
      'Deliver two vivid sentences describing the flow and outcome, then provide a short round-by-round log on new lines.',
      perspectiveInstruction,
      'Stay energetic, avoid dice jargon, and ground everything in the facts provided.',
      `Combat ID: ${combatLog.combatId}`,
      `Participants: ${combatLog.participant1} vs ${combatLog.participant2}`,
      `Winner: ${combatLog.winner}; Loser: ${combatLog.loser}; First strike: ${combatLog.firstAttacker}`,
      `Rounds completed: ${totalRounds}; Total damage: ${totalDamage}`,
      `Rewards (winner): +${combatLog.xpAwarded} XP, +${combatLog.goldAwarded} gold`,
      locationLine,
      roundBreakdownLine,
    ].join('\n');

    this.logger.debug(`Combat narrative AI prompt: ${prompt}`);
    try {
      const ai = await this.aiService.getText(prompt, {
        timeoutMs: 20000,
        maxTokens: 220,
        model: 'gpt-4o-mini',
      });
      const rawText = (ai?.output_text ?? '').trim();
      if (rawText) {
        const cleaned = rawText
          .replace(/^```(json)?\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        if (cleaned) return cleaned;
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
  ) {
    if (participant.type !== 'player' || !participant.slackId) return null;
    const options = { secondPersonName: participant.name };
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

    const attackerPromise = measure(() =>
      this.buildParticipantMessage(combatLog, attacker, 'attacker'),
    );
    const defenderEligible =
      defender.type === 'player' &&
      !!defender.slackId &&
      defender.slackId !== attacker.slackId;
    const defenderPromise = defenderEligible
      ? measure(() =>
          this.buildParticipantMessage(combatLog, defender, 'defender'),
        )
      : undefined;
    const observerLookupPromise = measure(() =>
      this.playerService.getPlayersAtLocation(x, y, {
        excludePlayerId: attacker.type === 'player' ? attacker.id : undefined,
      }),
    );
    const observerNarrativePromise = measure(() =>
      this.generateCombatNarrative(combatLog, {}),
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
    const observers = observersResult.value as any[];

    const observerNarrativeResult = await observerNarrativePromise;
    perf.observerNarrativeMs = observerNarrativeResult.duration;
    const observerMessage = observerNarrativeResult.value;

    const observerSummaryResult = await observerSummaryPromise;
    perf.observerSummaryMs = observerSummaryResult.duration;
    const observerSummary = observerSummaryResult.value;

    for (const observer of observers) {
      if (defender.type === 'player' && observer.id === defender.id) continue;
      if (observer.clientType === 'slack' && observer.clientId) {
        messages.push({
          slackId: observer.clientId,
          name: observer.name,
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
