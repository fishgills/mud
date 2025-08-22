import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { Direction } from '../generated/dm-graphql';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import {
  buildLocationBlocks,
  formatLocationMessage,
  LocationData,
} from './locationUtils';
import { COMMANDS, MOVE_ACTIONS } from '../commands';

const directionMap: Record<string, Direction> = {
  [COMMANDS.UP]: Direction.NORTH,
  [COMMANDS.NORTH]: Direction.NORTH,
  [COMMANDS.DOWN]: Direction.SOUTH,
  [COMMANDS.SOUTH]: Direction.SOUTH,
  [COMMANDS.LEFT]: Direction.WEST,
  [COMMANDS.WEST]: Direction.WEST,
  [COMMANDS.RIGHT]: Direction.EAST,
  [COMMANDS.EAST]: Direction.EAST,
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

    // Send a polished Block Kit message with quick movement actions and debug info
    const blocks = buildLocationBlocks(locationData, direction, {
      includeDebug: true,
    });
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '⬆️ North' },
          action_id: MOVE_ACTIONS.NORTH,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '⬇️ South' },
          action_id: MOVE_ACTIONS.SOUTH,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '⬅️ West' },
          action_id: MOVE_ACTIONS.WEST,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '➡️ East' },
          action_id: MOVE_ACTIONS.EAST,
        },
      ],
    });
    await say({ text: formatLocationMessage(locationData, direction), blocks });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to move');
    await say({ text: errorMessage });
  }
};

// Register handlers for all direction keys (emojis and words)
Object.keys(directionMap).forEach((key) => {
  registerHandler(key, moveHandler);
});
