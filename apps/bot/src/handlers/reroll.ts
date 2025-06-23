import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';

export const rerollHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const result = await dmSdk.RerollPlayerStats({ slackId: userId });
    if (result.updatePlayerStats.success) {
      const stats = result.updatePlayerStats.data;
      await say({
        text: `🎲 Rerolled stats: Strength: ${stats?.strength}, Agility: ${stats?.agility}, Health: ${stats?.health}`,
      });
    } else {
      await say({ text: `Error: ${result.updatePlayerStats.message}` });
    }
  } catch (err) {
    await say({ text: `Failed to reroll stats: ${err}` });
  }
};
