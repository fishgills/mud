import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';

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
  } catch (err) {
    await say({ text: `Failed to complete character: ${err}` });
  }
};
