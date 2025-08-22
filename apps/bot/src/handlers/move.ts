import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { Direction } from '../generated/dm-graphql';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { formatLocationMessage, LocationData } from './locationUtils';

const directionMap: Record<string, Direction> = {
  up: Direction.NORTH,
  north: Direction.NORTH,
  down: Direction.SOUTH,
  south: Direction.SOUTH,
  left: Direction.WEST,
  west: Direction.WEST,
  right: Direction.EAST,
  east: Direction.EAST,
};

export const moveHandlerHelp = `Move your character using direction words: up, down, left, right, north, south, east, west. Example: Send "up" or "north" to move north.`;
export const moveHandler = async ({ userId, say, text }: HandlerContext) => {
  // Normalize input for matching
  const lowerText = text.toLowerCase();
  const found = Object.entries(directionMap).find(([key]) =>
    lowerText.includes(key),
  );
  if (!found) {
    await say({
      text: 'Please use a direction: up, down, left, right, north, south, east, or west.',
    });
    return;
  }
  const [, direction] = found;
  try {
    const result = await dmSdk.MovePlayer({
      slackId: userId,
      input: { direction },
    });
    if (!result.movePlayer.success) {
      await say({ text: `Move failed: ${result.movePlayer.message}` });
      return;
    }
    const data = result.movePlayer.data;
    if (!data) {
      await say({ text: 'Move succeeded but no data returned.' });
      return;
    }

    const locationData: LocationData = {
      location: data.location,
      surroundingTiles: data.surroundingTiles,
      monsters: data.monsters,
      playerInfo: data.playerInfo,
      description: data.description,
    };

    const msg = formatLocationMessage(locationData, direction);
    await say({ text: msg });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to move');
    await say({ text: errorMessage });
  }
};

// Register handlers for all direction keys (emojis and words)
Object.keys(directionMap).forEach((key) => {
  registerHandler(key, moveHandler);
});
