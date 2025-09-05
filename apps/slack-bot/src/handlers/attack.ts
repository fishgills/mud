import { TargetType } from '../generated/dm-graphql';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

export const attackHandlerHelp = `Attack the nearest monster using "attack". Example: Send "attack" to fight nearby enemies.`;

export const attackHandler = async ({ userId, say }: HandlerContext) => {
  // For demo: attack the first nearby monster (could be improved with more context)
  try {
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

    const log = combat.combatLog;
    const isPlayerWinner = combat.winnerName === player.name;
    const defenderName = combat.loserName;
    const playerDamage = combat.totalDamageDealt;

    let msg = `You attacked ${defenderName} for ${playerDamage} total damage!`;
    msg += `\nCombat lasted ${combat.roundsCompleted} rounds.`;

    if (isPlayerWinner) {
      msg += `\n${defenderName} was defeated!`;
      if (combat.xpGained > 0) {
        msg += `\nYou gained ${combat.xpGained} XP!`;
      }
    } else {
      msg += `\n${defenderName} defeated you!`;
    }

    // Add some combat details
    msg += `\n\n**Combat Summary:**`;
    msg += `\nInitiative: ${log.firstAttacker} went first`;
    if (log.rounds.length > 0) {
      const lastRound = log.rounds[log.rounds.length - 1];
      msg += `\nFinal blow: ${lastRound.attackerName} hit for ${lastRound.damage} damage`;
    }
    await say({ text: msg });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to attack');
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.ATTACK, attackHandler);
