import { registerHandler } from './handlerRegistry';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { getUserFriendlyErrorMessage } from './errorUtils';

export const completeHandlerHelp = `Complete your character creation with "complete". Example: Send "complete" when you are done creating your character.`;

export const completeHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const result = await dmSdk.CompletePlayer({ slackId: userId });
    if (result.updatePlayerStats.success) {
      await say({
        text: `✅ Character creation complete! You can now move and attack.`,
      });
    } else {
      await say({ text: `Error: ${result.updatePlayerStats.message}` });
    }
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to complete character',
    );
    await say({ text: errorMessage });
  }
};

// Register handler for text command only
registerHandler('complete', completeHandler);
