import { registerHandler } from './handlerRegistry';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

export const rerollHandlerHelp = `Reroll your character's stats with "reroll". Example: Send "reroll" to reroll stats during character creation.`;

export const rerollHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const result = await dmSdk.RerollPlayerStats({ slackId: userId });
    if (result.rerollPlayerStats.success) {
      const stats = result.rerollPlayerStats.data;
      await say({
        text: `🎲 Rerolled stats: Strength: ${stats?.strength}, Agility: ${stats?.agility}, Health: ${stats?.health}`,
      });
    } else {
      await say({ text: `Error: ${result.rerollPlayerStats.message}` });
    }
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to reroll stats',
    );
    await say({ text: errorMessage });
  }
};

// Register handler for text command only
registerHandler(COMMANDS.REROLL, rerollHandler);
