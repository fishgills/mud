import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { GetPlayerQuery } from '../generated/dm-graphql';

export const EMOJI_STATS = ':bar_chart:';
export const statsHandlerHelp = `Show your character's stats with ${EMOJI_STATS}. Example: Send ${EMOJI_STATS} to see your stats.`;

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
    ? '_Character creation not complete! Use :game_die: to reroll, :white_check_mark: to finish._\n'
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
      await say({ text: `Error: ${result.getPlayer.message}` });
    }
  } catch (err) {
    await say({ text: `Failed to load stats: ${err}` });
  }
};

registerHandler(EMOJI_STATS, statsHandler);
registerHandler('stats', statsHandler); // Also register for text "stats" to allow natural language
