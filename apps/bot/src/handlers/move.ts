import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { Direction } from '../generated/dm-graphql';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
// No debug JSON on move; keep the channel clean.
import { sendPngMap } from './mapUtils';
import { COMMANDS } from '../commands';

const directionMap: Record<string, Direction> = {
  [COMMANDS.UP]: Direction.North,
  [COMMANDS.NORTH]: Direction.North,
  [COMMANDS.DOWN]: Direction.South,
  [COMMANDS.SOUTH]: Direction.South,
  [COMMANDS.LEFT]: Direction.West,
  [COMMANDS.WEST]: Direction.West,
  [COMMANDS.RIGHT]: Direction.East,
  [COMMANDS.EAST]: Direction.East,
};

export const moveHandlerHelp = `Move your character using direction words: up, down, left, right, north, south, east, west. Example: Send "up" or "north" to move north.`;
export const moveHandler = async ({ userId, say, text }: HandlerContext) => {
  const t0 = Date.now();
  let dmMs = 0;
  let pngMs = 0;
  let finalMsgMs = 0;
  let totalMs = 0;
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
    const tDmStart = Date.now();
    const result = await dmSdk.MovePlayer({
      slackId: userId,
      input: { direction },
    });
    dmMs = Date.now() - tDmStart;
    if (!result.movePlayer.success) {
      await say({ text: `Move failed: ${result.movePlayer.message}` });
      totalMs = Date.now() - t0;
      console.log(
        `move timing (fail): user=${userId} dir=${direction.toLowerCase()} dmMs=${dmMs} totalMs=${totalMs}`,
      );
      return;
    }
    const data = result.movePlayer.player;
    if (!data) {
      await say({ text: 'Move succeeded but no data returned.' });
      totalMs = Date.now() - t0;
      console.log(
        `move timing (nodata): user=${userId} dir=${direction.toLowerCase()} dmMs=${dmMs} totalMs=${totalMs}`,
      );
      return;
    }
    // Send only the PNG map centered on the new location; no text.
    const tPngStart = Date.now();
    await sendPngMap(say, data.x, data.y, 8);

    if (result.movePlayer.monsters.length > 0) {
      await say({
        text: `You see the following monsters at your location: ${result.movePlayer.monsters.map((m) => m.name).join(', ')}`,
      });
    }
    if (result.movePlayer.playersAtLocation.length > 0) {
      await say({
        text: `You see the following players at your location: ${result.movePlayer.playersAtLocation.map((p) => p.name).join(', ')}`,
      });
    }
    pngMs = Date.now() - tPngStart;
    const tMsgStart = Date.now();
    await say({
      text: `You moved ${direction.toLowerCase()}. You are now at (${data.x}, ${data.y}).`,
    });
    finalMsgMs = Date.now() - tMsgStart;
    totalMs = Date.now() - t0;
    console.log(
      `move timing: user=${userId} dir=${direction.toLowerCase()} dmMs=${dmMs} pngMs=${pngMs} finalMsgMs=${finalMsgMs} totalMs=${totalMs}`,
    );
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to move');
    await say({ text: errorMessage });
    totalMs = Date.now() - t0;
    console.log(
      `move timing (error): user=${userId} dir=${direction.toLowerCase()} dmMs=${dmMs} pngMs=${pngMs} finalMsgMs=${finalMsgMs} totalMs=${totalMs}`,
    );
  }
};

// Register handlers for all direction keys (emojis and words)
Object.keys(directionMap).forEach((key) => {
  registerHandler(key, moveHandler);
});
