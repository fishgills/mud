import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { GetPlayerQuery } from '../generated/dm-graphql';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

export const statsHandlerHelp = `Show your character's stats with "stats". Example: Send "stats" to see your character information.`;

type PlayerStats = NonNullable<GetPlayerQuery['getPlayer']['data']>;

export function formatPlayerStats(player: PlayerStats): string {
  const stat = (v: any) => (v === undefined || v === null ? '?' : v);

  // Check if character creation is complete by looking at key stats
  const incomplete = [
    player.strength,
    player.agility,
    player.health,
    player.maxHp,
  ].some((v) => v == null || v === 0)
    ? '_Character creation not complete! Use "reroll" to reroll stats, "complete" to finish._\n'
    : '';

  return (
    `${incomplete}` +
    `*Stats*\n- Name: ${stat(player.name)}\n- Strength: ${stat(player.strength)}\n- Agility: ${stat(player.agility)}\n- Health: ${stat(player.health)}\n- HP: ${stat(player.hp)}/${stat(player.maxHp)}\n- Gold: ${stat(player.gold)}\n- XP: ${stat(player.xp)}\n- Level: ${stat(player.level)}`
  );
}

export const statsHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const result = await dmSdk.GetPlayer({ slackId: userId });
    if (result.getPlayer.success && result.getPlayer.data) {
      // The data field contains the Player object with all stats
      const player = result.getPlayer.data;
      const statsMsg = formatPlayerStats(player);
      await say({ text: statsMsg });
    } else {
      // Handle the case where the player doesn't exist
      await say({
        text: `You don't have a character yet! Use "new CharacterName" to create one.`,
      });
    }
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to load stats',
    );
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.STATS, statsHandler);
