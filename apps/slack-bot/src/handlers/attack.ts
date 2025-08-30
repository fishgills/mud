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
    let msg = `You attacked ${combat.defenderName} for ${combat.damage} damage!`;
    if (combat.isDead) {
      msg += `\n${combat.defenderName} was defeated!`;
    } else {
      msg += `\n${combat.defenderName} has ${combat.defenderHp}/${combat.defenderMaxHp} HP left.`;
    }
    if (combat.xpGained) {
      msg += `\nYou gained ${combat.xpGained} XP!`;
    }
    await say({ text: msg });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to attack');
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.ATTACK, attackHandler);
