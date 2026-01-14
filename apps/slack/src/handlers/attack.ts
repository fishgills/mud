import { AttackOrigin, TargetType } from '../dm-types';
import { HandlerContext, type SayMessage } from './types';
import { COMMANDS, ATTACK_ACTIONS } from '../commands';
import { PlayerCommandHandler } from './base';
import { requireCharacter } from './characterUtils';
import { buildMonsterOption, type SlackOption } from './entitySelection';
import {
  buildAttackFailureMessage,
  isMissingTargetCharacterMessage,
  notifyTargetAboutMissingCharacter,
} from './attackNotifications';
import type { WebClient } from '@slack/web-api';

export const MONSTER_SELECTION_BLOCK_ID = 'attack_monster_selection_block';
export const SELF_ATTACK_ERROR = "You can't attack yourself.";

type AttackCombatResult = {
  winnerName: string;
  loserName: string;
  totalDamageDealt: number;
  roundsCompleted: number;
  xpGained: number;
  goldGained: number;
  message: string;
  playerMessages?: Array<{
    userId?: string;
    teamId?: string;
    name: string;
    message: string;
    role: string;
    blocks?: Array<Record<string, unknown>>;
  }>;
};

type NearbyMonster = { id: string; name: string };

export function buildTargetSelectionMessage(
  monsters: NearbyMonster[],
) {
  const monsterList = monsters.map((m) => m.name).join(', ');
  const anyMonsters = monsters.length > 0;

  const options: SlackOption[] = [];
  for (const monster of monsters) {
    const option = buildMonsterOption(monster);
    if (option) {
      options.push(option);
    }
  }

  const firstOption = options[0];

  const headerParts: string[] = [];
  if (anyMonsters) headerParts.push(`monsters: ${monsterList}`);
  const headerText = headerParts.length
    ? `Available targets — ${headerParts.join(' | ')}`
    : 'Choose a target to attack:';

  return {
    text: 'Choose a target to attack',
    blocks: [
      {
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: headerText },
      },
      {
        type: 'actions' as const,
        block_id: MONSTER_SELECTION_BLOCK_ID,
        elements: [
          {
            type: 'static_select' as const,
            action_id: ATTACK_ACTIONS.MONSTER_SELECT,
            placeholder: {
              type: 'plain_text' as const,
              text: 'Select a target',
              emoji: true,
            },
            options,
            ...(firstOption
              ? {
                  initial_option: firstOption,
                }
              : {}),
          },
          {
            type: 'button' as const,
            action_id: ATTACK_ACTIONS.ATTACK_MONSTER,
            text: {
              type: 'plain_text' as const,
              text: 'Attack',
              emoji: true,
            },
            style: 'primary' as const,
            value: 'attack_target',
          },
        ],
      },
    ],
  };
}

export function buildCombatSummary(
  combat: AttackCombatResult,
  monsterName: string,
) {
  const playerWon = combat.winnerName !== monsterName;

  let msg = `You attacked ${monsterName}!`;
  if (playerWon) {
    msg += `\n${monsterName} was defeated!`;
    if (combat.xpGained > 0) {
      msg += `\nYou gained ${combat.xpGained} XP!`;
    }
    if (combat.goldGained > 0) {
      msg += `\nYou collected ${combat.goldGained} gold!`;
    }
  } else {
    msg += `\n${monsterName} defeated you!`;
  }

  msg += `\nCombat lasted ${combat.roundsCompleted} rounds.\n`;
  msg += `\n${combat.message}`;
  return msg;
}

/**
 * Handle successful attack - sends initiation message and delivers combat messages
 */
export async function handleSuccessfulAttack(
  client: WebClient | undefined,
  say: ((msg: SayMessage) => Promise<void>) | null,
  channelId?: string,
): Promise<void> {
  const initMessage = {
    text: '⚔️ Combat initiated! Check your DMs for the results.',
  };

  if (say) {
    // Text-based attack (has say function)
    await say(initMessage);
  } else if (channelId && client) {
    // Button-based attack (uses client directly)
    await client.chat.postMessage({
      channel: channelId,
      ...initMessage,
    });
  }

  // Combat messages are now delivered via the notification service (Redis), not directly via client
}

export class AttackHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.ATTACK, 'Failed to attack');
  }

  protected async perform({
    userId,
    say,
    text,
    client,
  }: HandlerContext): Promise<void> {
    const metrics: {
      branch: string;
      dmAttackMs: number;
      dmGetPlayerMs: number;
      dmGetMonstersMs: number;
      targetType?: string;
      attackOrigin?: AttackOrigin;
    } = {
      branch: 'initial',
      dmAttackMs: 0,
      dmGetPlayerMs: 0,
      dmGetMonstersMs: 0,
      targetType: undefined,
      attackOrigin: undefined,
    };

    const parts = text.trim().split(/\s+/);
    const maybeTarget = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const mentionMatch = maybeTarget.match(/^<@([A-Z0-9]+)>$/i);
    const atNameMatch = maybeTarget.match(/^@([A-Za-z0-9._-]+)$/);

    if (mentionMatch || atNameMatch) {
      metrics.branch = 'direct-target';
      metrics.targetType = 'player';
      const targetSlackId = mentionMatch ? mentionMatch[1] : undefined;
      const targetName = atNameMatch ? atNameMatch[1] : undefined;
      metrics.attackOrigin = targetSlackId
        ? AttackOrigin.TextPvp
        : AttackOrigin.GhostPvp;
      if (!targetSlackId && !targetName) {
        await say({
          text: 'Use `attack @name` or mention the player to start a duel.',
        });
        return;
      }
      if (targetSlackId && targetSlackId === userId) {
        await say({ text: SELF_ATTACK_ERROR });
        return;
      }

      const attackStart = Date.now();
      const attackResult = await this.dm.attack({
        teamId: this.teamId!,
        userId,
        input: {
          targetType: TargetType.Player,
          targetUserId: targetSlackId,
          targetTeamId: targetSlackId ? this.teamId! : undefined,
          targetName,
          attackOrigin: targetSlackId ? AttackOrigin.TextPvp : undefined,
        },
      });
      metrics.dmAttackMs = Date.now() - attackStart;

      if (!attackResult.success) {
        const fallbackName = targetSlackId
          ? `<@${targetSlackId}>`
          : targetName
            ? `@${targetName}`
            : 'that player';
        await say({
          text: buildAttackFailureMessage(attackResult.message, {
            targetKind: 'player',
            targetName: fallbackName,
          }),
        });

        if (
          targetSlackId &&
          isMissingTargetCharacterMessage(attackResult.message)
        ) {
          await notifyTargetAboutMissingCharacter(
            client,
            userId,
            targetSlackId,
          );
        }
        return;
      }

      const combat = attackResult.data as AttackCombatResult | undefined;
      if (!combat) {
        await say({ text: 'Attack succeeded but no combat data returned.' });
        return;
      }

      // Event bus will deliver combat resolution; no local summary
      return;
    }

    metrics.branch = 'selection';
    metrics.targetType = undefined;

    const playerLookupStart = Date.now();
    const player = await requireCharacter(this.teamId!, userId, say);
    metrics.dmGetPlayerMs = Date.now() - playerLookupStart;

    if (!player) {
      return;
    }

    const monstersStart = Date.now();
    const monsters = await this.dm.getMonsters();
    metrics.dmGetMonstersMs = Date.now() - monstersStart;

    const availableMonsters: NearbyMonster[] = (monsters || [])
      .filter((monster) => monster && monster.id !== undefined)
      .map((monster) => ({
        id: String(monster.id),
        name: monster.name ?? 'Unknown Monster',
      }));

    if (availableMonsters.length === 0) {
      await say({ text: 'No monsters available to attack right now.' });
      return;
    }

    if (!maybeTarget) {
      await say(buildTargetSelectionMessage(availableMonsters));
      return;
    }

    const normalizedTarget = maybeTarget.trim().toLowerCase();
    const matchingMonsters = availableMonsters.filter(
      (monster) => monster.name.toLowerCase() === normalizedTarget,
    );

    if (matchingMonsters.length === 1) {
      const targetId = Number(matchingMonsters[0].id);
      if (!Number.isFinite(targetId)) {
        await say({ text: 'Unable to resolve that monster right now.' });
        return;
      }

      const attackStart = Date.now();
      const attackResult = await this.dm.attack({
        teamId: this.teamId!,
        userId,
        input: {
          targetType: TargetType.Monster,
          targetId,
          attackOrigin: AttackOrigin.TextPve,
        },
      });
      metrics.dmAttackMs = Date.now() - attackStart;

      if (!attackResult.success) {
        await say({
          text: buildAttackFailureMessage(attackResult.message, {
            targetKind: 'monster',
            targetName: matchingMonsters[0].name,
          }),
        });
      }
      return;
    }

    if (matchingMonsters.length > 1) {
      await say(buildTargetSelectionMessage(matchingMonsters));
      return;
    }

    await say({
      text: `I couldn't find a monster named "${maybeTarget}". Try \`attack\` to pick from the list.`,
    });
  }
}

export const attackHandler = new AttackHandler();
