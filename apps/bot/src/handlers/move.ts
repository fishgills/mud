import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { Direction } from '../generated/dm-graphql';
import { registerHandler } from './handlerRegistry';

// Emoji directions
export const EMOJI_NORTH = ':arrow_up:';
export const EMOJI_EAST = ':arrow_right:';
export const EMOJI_SOUTH = ':arrow_down:';
export const EMOJI_WEST = ':arrow_left:';

const directionMap: Record<string, Direction> = {
  [EMOJI_NORTH]: Direction.NORTH,
  [EMOJI_EAST]: Direction.EAST,
  [EMOJI_SOUTH]: Direction.SOUTH,
  [EMOJI_WEST]: Direction.WEST,
  up: Direction.NORTH,
  north: Direction.NORTH,
  down: Direction.SOUTH,
  south: Direction.SOUTH,
  left: Direction.WEST,
  west: Direction.WEST,
  right: Direction.EAST,
  east: Direction.EAST,
};

export const moveHandlerHelp = `Move your character using direction emojis or words: ⬆️ ⬇️ ⬅️ ➡️, up, down, left, right, north, south, east, west. Example: Send ⬆️ or 'up' to move north.`;
export const moveHandler = async ({ userId, say, text }: HandlerContext) => {
  // Normalize input for matching
  const lowerText = text.toLowerCase();
  const found = Object.entries(directionMap).find(([key]) =>
    lowerText.includes(key),
  );
  if (!found) {
    await say({
      text: 'Please use a direction: ⬆️ ⬇️ ⬅️ ➡️, up, down, left, right, north, south, east, or west.',
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
    let msg = `You moved ${direction}.\n`;
    msg += `You are now at (${data.location.x}, ${data.location.y}) in a ${data.location.biomeName} biome.\n`;
    msg += data.location.description ? `${data.location.description}\n` : '';
    if (data.surroundingTiles && data.surroundingTiles.length) {
      msg += 'Nearby tiles:\n';
      for (const tile of data.surroundingTiles) {
        msg += `- ${tile.direction}: ${tile.biomeName} (${tile.description || 'no description'})\n`;
      }
    }
    if (data.monsters && data.monsters.length) {
      msg += `Monsters nearby: ${data.monsters.map((m) => m.name).join(', ')}\n`;
    }
    if (data.playerInfo) {
      msg += data.playerInfo + '\n';
    }
    await say({ text: msg });
  } catch (err) {
    await say({ text: `Failed to move: ${err}` });
  }
};

// Register handlers for all direction keys (emojis and words)
Object.keys(directionMap).forEach((key) => {
  registerHandler(key, moveHandler);
});
