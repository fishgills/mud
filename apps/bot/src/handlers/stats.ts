import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { Player } from '../generated/dm-graphql';

export const EMOJI_STATS = ':bar_chart:';
export const statsHandlerHelp = `Show your character's stats with ${EMOJI_STATS}. Example: Send ${EMOJI_STATS} to see your stats.`;

export function formatPlayerStats(player: Player): string {
  return `*Stats*\n- Name: ${player.name}\n- Strength: ${player.strength}\n- Agility: ${player.agility}\n- Health: ${player.health}\n- HP: ${player.hp}/${player.maxHp}\n- Gold: ${player.gold}\n- XP: ${player.xp}\n- Level: ${player.level}`;
}

export const statsHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const result = await dmSdk.GetPlayer({ slackId: userId });
    if (result.getPlayer.success && result.getPlayer.data) {
      // Cast to Player type if you are sure all fields are present
      const player = result.getPlayer.data as Player;
      const statsMsg = formatPlayerStats(player);
      await say({ text: statsMsg });
    } else {
      await say({ text: `Error: ${result.getPlayer.message}` });
    }
  } catch (err) {
    await say({ text: `Failed to load stats: ${err}` });
  }
};

registerHandler(EMOJI_STATS, statsHandler);
registerHandler('stats', statsHandler); // Also register for text "stats" to allow natural language
