import type { AttackMutation } from '../generated/dm-graphql';
import { TargetType } from '../generated/dm-graphql';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS, ATTACK_ACTIONS } from '../commands';
import { toClientId } from '../utils/clientId';

const MONSTER_SELECTION_BLOCK_ID = 'attack_monster_selection_block';

type AttackCombatResult = NonNullable<
  NonNullable<AttackMutation['attack']['data']>
>;

type NearbyMonster = { id: string; name: string };

export function buildMonsterSelectionMessage(monsters: NearbyMonster[]) {
  const monsterList = monsters.map((m) => m.name).join(', ');
  const firstMonster = monsters[0];

  return {
    text: `Choose a monster to attack: ${monsterList}`,
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `You see the following monsters at your location: ${monsterList}`,
        },
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
              text: 'Select a monster',
              emoji: true,
            },
            options: monsters.map((monster) => ({
              text: {
                type: 'plain_text' as const,
                text: monster.name,
                emoji: true,
              },
              value: monster.id,
            })),
            ...(firstMonster
              ? {
                  initial_option: {
                    text: {
                      type: 'plain_text' as const,
                      text: firstMonster.name,
                      emoji: true,
                    },
                    value: firstMonster.id,
                  },
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
            value: 'attack_monster',
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

export const attackHandlerHelp = `Attack the nearest monster using "attack". Or attack a player in this workspace from anywhere: "attack @username" or "attack username".`;

export const attackHandler = async ({
  userId,
  say,
  text,
  client,
}: HandlerContext) => {
  // For demo: attack the first nearby monster (could be improved with more context)
  try {
    // Try to parse a player target by username/mention
    const parts = text.trim().split(/\s+/);
    const maybeTarget = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const mentionMatch = maybeTarget.match(/^<@([A-Z0-9]+)>$/i);
    const atNameMatch = maybeTarget.match(/^@([A-Za-z0-9._-]+)$/);

    if (mentionMatch || atNameMatch) {
      // Attack player by Slack identifier within this workspace
      const targetSlackId = mentionMatch ? mentionMatch[1] : undefined;
      // If we only have a username, we can't resolve to Slack ID here without Web API; delegate to DM by username support later if added.
      if (!targetSlackId) {
        await say({
          text: 'Please mention the user like "attack @username" so I can identify them.',
        });
        return;
      }
      const attackResult = await dmSdk.Attack({
        slackId: toClientId(userId),
        input: {
          targetType: TargetType.Player,
          targetSlackId,
          ignoreLocation: true,
        },
      });
      if (!attackResult.attack.success) {
        await say({ text: `Attack failed: ${attackResult.attack.message}` });
        return;
      }
      const combat = attackResult.attack.data;
      if (!combat) {
        await say({ text: 'Attack succeeded but no combat data returned.' });
        return;
      }
      const playerMessages = combat.playerMessages ?? [];
      const attackerSummary =
        playerMessages.find((msg) => msg.slackId === userId)?.message ??
        combat.message;
      await say({ text: attackerSummary });

      const defenderSummary = playerMessages.find(
        (msg) => msg.slackId === targetSlackId,
      )?.message;

      if (defenderSummary && client) {
        try {
          const dm = await client.conversations.open({ users: targetSlackId });
          const channelId = dm.channel?.id as string | undefined;
          if (channelId) {
            await client.chat.postMessage({
              channel: channelId,
              text: defenderSummary,
            });
          }
        } catch (notifyError) {
          console.warn(
            `Failed to deliver PvP combat summary to defender ${targetSlackId}:`,
            notifyError,
          );
        }
      }
      console.log(JSON.stringify(combat, null, 2));
      return;
    }

    // Get player info to find nearby monsters
    const playerResult = await dmSdk.GetPlayer({
      slackId: toClientId(userId),
    });
    const player = playerResult.getPlayer.data;
    if (!player || !player.nearbyMonsters?.length) {
      await say({ text: 'No monsters nearby to attack!' });
      return;
    }
    await say(buildMonsterSelectionMessage(player.nearbyMonsters));
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to attack');
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.ATTACK, attackHandler);
