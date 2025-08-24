import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';

export const lookHandlerHelp = `Look around with enhanced vision based on terrain height. Returns a panoramic description, visible peaks, nearby settlements, and biome summary. Example: Send 'look' or 'l'.`;

export const lookHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const res = await dmSdk.GetLookView({ slackId: userId });
    if (!res.getLookView.success || !res.getLookView.data) {
      await say({
        text: `Failed to look: ${res.getLookView.message ?? 'unknown error'}`,
      });
      return;
    }
    // Send the panoramic description as the primary message
    await say({ text: res.getLookView.data.description });
    // Attach structured details for QA/debugging
    // await sendDebugJson(say, res.getLookView.data, {
    //   filename: 'look-result.json',
    //   title: 'Look result',
    // });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to look around',
    );
    await say({ text: errorMessage });
  }
};

// Register handlers for look commands
registerHandler(COMMANDS.LOOK, lookHandler);
registerHandler(COMMANDS.LOOK_SHORT, lookHandler);
