import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { Direction } from '../generated/dm-graphql';
import { registerHandler } from './handlerRegistry';

// Emoji directions
export const EMOJI_NORTH = '⬆️';
export const EMOJI_EAST = '➡️';
export const EMOJI_SOUTH = '⬇️';
export const EMOJI_WEST = '⬅️';

const directionMap: Record<string, Direction> = {
  [EMOJI_NORTH]: Direction.North,
  [EMOJI_EAST]: Direction.East,
  [EMOJI_SOUTH]: Direction.South,
  [EMOJI_WEST]: Direction.West,
};

export const moveHandlerHelp = `Move your character using direction emojis: ⬆️ ⬇️ ⬅️ ➡️. Example: Send ⬆️ to move north.`;
export const moveHandler = async ({ userId, say, text }: HandlerContext) => {
  const found = Object.entries(directionMap).find(([emoji]) =>
    text.includes(emoji),
  );
  if (!found) {
    await say({
      text: 'Please use one of the direction emojis to move: ⬆️ ⬇️ ⬅️ ➡️',
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

// Register handlers after all declarations
registerHandler(EMOJI_NORTH, moveHandler);
registerHandler(EMOJI_EAST, moveHandler);
registerHandler(EMOJI_SOUTH, moveHandler);
registerHandler(EMOJI_WEST, moveHandler);
