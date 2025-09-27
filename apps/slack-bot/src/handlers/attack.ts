import { TargetType } from '../generated/dm-graphql';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

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
        slackId: userId,
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
    const playerResult = await dmSdk.GetPlayer({ slackId: userId });
    const player = playerResult.getPlayer.data;
    if (!player || !player.nearbyMonsters?.length) {
      await say({ text: 'No monsters nearby to attack!' });
      return;
    }
    const monster = player.nearbyMonsters[0];
    const attackResult = await dmSdk.Attack({
      slackId: userId,
      input: { targetType: TargetType.Monster, targetId: Number(monster.id) },
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

    const isPlayerWinner = combat.winnerName === player.name;
    const defenderName = combat.loserName;
    // const playerDamage = combat.totalDamageDealt;

    let msg = `You attacked ${defenderName}!`;
    if (isPlayerWinner) {
      msg += `\n${defenderName} was defeated!`;
      if (combat.xpGained > 0) {
        msg += `\nYou gained ${combat.xpGained} XP!`;
      }
      if (combat.goldGained > 0) {
        msg += `\nYou collected ${combat.goldGained} gold!`;
      }
    } else {
      msg += `\n${defenderName} defeated you!`;
    }

    msg += `\nCombat lasted ${combat.roundsCompleted} rounds.\n`;

    // Add the AI-enhanced combat narrative
    msg += `\n${combat.message}`;
    await say({ text: msg });
    console.log(JSON.stringify(combat, null, 2));
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to attack');
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.ATTACK, attackHandler);
