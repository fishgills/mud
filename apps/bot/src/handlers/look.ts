import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';
import { sendDebugJson } from './debugUtils';

export const lookHandlerHelp = `Look around at your current location to see the area description, nearby tiles, monsters, and other players. Example: Send 'look' or 'l' to examine your surroundings.`;

export const lookHandler = async ({ userId, say }: HandlerContext) => {
  try {
    // Ask DM for the movement view (same shape as MovePlayer.data)
    const res = await dmSdk.GetMovementView({ slackId: userId });
    if (!res.getMovementView.success || !res.getMovementView.data) {
      await say({
        text: `Failed to look: ${res.getMovementView.message ?? 'unknown error'}`,
      });
      return;
    }
    await sendDebugJson(say, res.getMovementView.data, {
      filename: 'look-result.json',
      title: 'Look result',
    });
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
