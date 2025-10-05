import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { Direction } from '../generated/dm-graphql';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { toClientId } from '../utils/clientId';
// No debug JSON on move; keep the channel clean.
import { sendPngMap } from './mapUtils';
import { COMMANDS } from '../commands';
import { sendOccupantsSummary } from './locationUtils';

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
  const trimmedText = text.trim();
  const coordinateMatch = trimmedText.match(/^move\s+(-?\d+)\s+(-?\d+)$/i);

  let direction: Direction | undefined;
  let targetX: number | undefined;
  let targetY: number | undefined;
  let movementLabel = 'unknown';

  if (coordinateMatch) {
    targetX = Number.parseInt(coordinateMatch[1], 10);
    targetY = Number.parseInt(coordinateMatch[2], 10);
    movementLabel = `(${targetX}, ${targetY})`;
  } else {
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
    [, direction] = found;
    movementLabel = direction.toLowerCase();
  }
  try {
    const tDmStart = Date.now();
    const result = await dmSdk.MovePlayer({
      slackId: toClientId(userId),
      input: direction
        ? { direction }
        : { x: targetX as number, y: targetY as number },
    });
    dmMs = Date.now() - tDmStart;
    if (!result.movePlayer.success) {
      await say({ text: `Move failed: ${result.movePlayer.message}` });
      totalMs = Date.now() - t0;
      console.log(
        `move timing (fail): user=${userId} move=${movementLabel} dmMs=${dmMs} totalMs=${totalMs}`,
      );
      return;
    }
    const data = result.movePlayer.player;
    if (!data) {
      await say({ text: 'Move succeeded but no data returned.' });
      totalMs = Date.now() - t0;
      console.log(
        `move timing (nodata): user=${userId} move=${movementLabel} dmMs=${dmMs} totalMs=${totalMs}`,
      );
      return;
    }
    // Send only the PNG map centered on the new location; no text.
    const tPngStart = Date.now();
    await sendPngMap(say, data.x, data.y, 8);

    // Unified occupants summary using move response data
    await sendOccupantsSummary(
      say,
      result.movePlayer.playersAtLocation,
      result.movePlayer.monsters,
      userId,
    );
    pngMs = Date.now() - tPngStart;
    const tMsgStart = Date.now();
    await say({
      text: direction
        ? `You moved ${direction.toLowerCase()}. You are now at (${data.x}, ${data.y}).`
        : `You moved directly to (${data.x}, ${data.y}).`,
    });
    finalMsgMs = Date.now() - tMsgStart;
    totalMs = Date.now() - t0;
    console.log(
      `move timing: user=${userId} move=${movementLabel} dmMs=${dmMs} pngMs=${pngMs} finalMsgMs=${finalMsgMs} totalMs=${totalMs}`,
    );
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(err, 'Failed to move');
    await say({ text: errorMessage });
    totalMs = Date.now() - t0;
    console.log(
      `move timing (error): user=${userId} move=${movementLabel} dmMs=${dmMs} pngMs=${pngMs} finalMsgMs=${finalMsgMs} totalMs=${totalMs}`,
    );
  }
};

// Register handlers for all direction keys (emojis and words)
Object.keys(directionMap).forEach((key) => {
  registerHandler(key, moveHandler);
});
registerHandler(COMMANDS.MOVE, moveHandler);
