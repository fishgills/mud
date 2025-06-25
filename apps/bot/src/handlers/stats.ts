import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';

export const EMOJI_STATS = ':bar_chart:';
export const statsHandlerHelp = `Show your character's stats with ${EMOJI_STATS}. Example: Send ${EMOJI_STATS} to see your stats.`;

export function formatPlayerStats(player: any): string {
  return `*Stats*\n- Name: ${player.name}\n- Strength: ${player.strength}\n- Agility: ${player.agility}\n- Health: ${player.health}\n- HP: ${player.hp}/${player.maxHp}\n- Gold: ${player.gold}\n- XP: ${player.xp}\n- Level: ${player.level}`;
}

export const statsHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const result = await dmSdk.GetPlayer({ slackId: userId });
    if (result.getPlayer.success && result.getPlayer.data) {
      const statsMsg = formatPlayerStats(result.getPlayer.data);
      await say({ text: statsMsg });
    } else {
      await say({ text: `Error: ${result.getPlayer.message}` });
    }
  } catch (err) {
    await say({ text: `Failed to load stats: ${err}` });
  }
};

registerHandler(EMOJI_STATS, statsHandler);
