import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { formatLocationMessage, LocationData } from './locationUtils';

export const lookHandlerHelp = `Look around at your current location to see the area description, nearby tiles, monsters, and other players. Example: Send 'look' or 'l' to examine your surroundings.`;

export const lookHandler = async ({ userId, say }: HandlerContext) => {
  try {
    // Get the player with enhanced location information
    const playerResult = await dmSdk.GetPlayerWithLocation({ slackId: userId });

    if (!playerResult.getPlayer.success) {
      await say({
        text: `Failed to get player info: ${playerResult.getPlayer.message}`,
      });
      return;
    }

    const player = playerResult.getPlayer.data;
    if (!player) {
      await say({ text: 'Player data not found.' });
      return;
    }

    // Format the response using the shared utility (without move direction)
    const formattedData: LocationData = {
      location: {
        x: player.x,
        y: player.y,
        biomeName: player.currentTile?.biomeName || 'unknown',
        description: player.currentTile?.description,
      },
      monsters: player.nearbyMonsters || undefined,
      // Note: We still don't have surroundingTiles and playerInfo in this query
      // but we have the basic location info and nearby monsters
    };

    const msg = formatLocationMessage(formattedData);
    await say({ text: msg });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to look around',
    );
    await say({ text: errorMessage });
  }
};

// Register handlers for look commands
registerHandler('look', lookHandler);
registerHandler('l', lookHandler);
