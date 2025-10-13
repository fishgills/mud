import { HandlerContext } from './types';
import { Direction } from '../dm-types';
// No debug JSON on move; keep the channel clean.
import { sendPngMap } from './mapUtils';
import { COMMANDS } from '../commands';
import { sendOccupantsSummary } from './locationUtils';
import { MOVEMENT_COMMAND_SET, PlayerCommandHandler } from './base';

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
export class MoveHandler extends PlayerCommandHandler {
  constructor() {
    super(MOVEMENT_COMMAND_SET, 'Failed to move');
  }

  protected async perform({
    userId,
    say,
    text,
  }: HandlerContext): Promise<void> {
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
    let requestedDistance: number | undefined;
    let movementLabel = 'unknown';

    if (coordinateMatch) {
      targetX = Number.parseInt(coordinateMatch[1], 10);
      targetY = Number.parseInt(coordinateMatch[2], 10);
      movementLabel = `(${targetX}, ${targetY})`;
    } else {
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
      const [directionKey, mappedDirection] = found;
      direction = mappedDirection;

      const lowerTrimmed = trimmedText.toLowerCase();
      const directionIndex = lowerTrimmed.indexOf(directionKey);
      if (directionIndex >= 0) {
        const afterDirection = trimmedText
          .slice(directionIndex + directionKey.length)
          .trim();
        const distanceMatch = afterDirection.match(/(\d+)/);
        if (distanceMatch) {
          const parsedDistance = Number.parseInt(distanceMatch[1], 10);
          if (!Number.isNaN(parsedDistance)) {
            requestedDistance = parsedDistance;
          }
        }
      }
      if (requestedDistance === undefined) {
        const fallbackMatch = trimmedText.match(
          /\b(?:up|down|left|right|north|south|east|west)\b\D*(\d+)/i,
        );
        if (fallbackMatch) {
          const parsedDistance = Number.parseInt(fallbackMatch[1], 10);
          if (!Number.isNaN(parsedDistance)) {
            requestedDistance = parsedDistance;
          }
        }
      }
      if (requestedDistance === undefined && directionIndex > 0) {
        const beforeDirection = trimmedText
          .slice(0, directionIndex)
          .match(/(\d+)/);
        if (beforeDirection) {
          const parsedDistance = Number.parseInt(beforeDirection[1], 10);
          if (!Number.isNaN(parsedDistance)) {
            requestedDistance = parsedDistance;
          }
        }
      }
      movementLabel =
        requestedDistance && requestedDistance > 1
          ? `${direction.toLowerCase()} x${requestedDistance}`
          : direction.toLowerCase();
    }

    try {
      const tDmStart = Date.now();
      const result = await this.dm.movePlayer({
        slackId: this.toClientId(userId),
        input: direction
          ? {
              direction,
              ...(requestedDistance !== undefined
                ? { distance: requestedDistance }
                : {}),
            }
          : { x: targetX as number, y: targetY as number },
      });
      dmMs = Date.now() - tDmStart;
      if (!result.success) {
        await say({ text: `Move failed: ${result.message}` });
        totalMs = Date.now() - t0;
        console.log(
          `move timing (fail): user=${userId} move=${movementLabel} dmMs=${dmMs} totalMs=${totalMs}`,
        );
        return;
      }
      const data = result.player;
      if (!data) {
        await say({ text: 'Move succeeded but no data returned.' });
        totalMs = Date.now() - t0;
        console.log(
          `move timing (nodata): user=${userId} move=${movementLabel} dmMs=${dmMs} totalMs=${totalMs}`,
        );
        return;
      }
      if (typeof data.x !== 'number' || typeof data.y !== 'number') {
        await say({ text: 'Move succeeded but your new location is unclear.' });
        totalMs = Date.now() - t0;
        console.log(
          `move timing (noloc): user=${userId} move=${movementLabel} dmMs=${dmMs} totalMs=${totalMs}`,
        );
        return;
      }
      const tPngStart = Date.now();
      await sendPngMap(say, data.x, data.y, 8);

      await sendOccupantsSummary(
        say,
        result.playersAtLocation,
        result.monsters,
        userId,
      );
      pngMs = Date.now() - tPngStart;
      const tMsgStart = Date.now();
      const stepsUsed = requestedDistance ?? 1;
      const directionText = direction?.toLowerCase();
      const movementText =
        directionText && stepsUsed > 1
          ? `You moved ${directionText} ${stepsUsed} spaces.`
          : directionText
            ? `You moved ${directionText}.`
            : `You moved directly to (${data.x}, ${data.y}).`;
      await say({
        text: direction
          ? `${movementText} You are now at (${data.x}, ${data.y}).`
          : `You moved directly to (${data.x}, ${data.y}).`,
      });
      finalMsgMs = Date.now() - tMsgStart;
      totalMs = Date.now() - t0;
      console.log(
        `move timing: user=${userId} move=${movementLabel} dmMs=${dmMs} pngMs=${pngMs} finalMsgMs=${finalMsgMs} totalMs=${totalMs}`,
      );
    } catch (error) {
      totalMs = Date.now() - t0;
      console.log(
        `move timing (error): user=${userId} move=${movementLabel} dmMs=${dmMs} pngMs=${pngMs} finalMsgMs=${finalMsgMs} totalMs=${totalMs}`,
      );
      throw error;
    }
  }
}

export const moveHandler = new MoveHandler();
