import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { sendPngMap } from './mapUtils';
import { getOccupantsSummaryAt } from './locationUtils';
import { PlayerCommandHandler } from './base';

export const mapHandlerHelp = `Display the ASCII map with "map". Example: Send "map" to see the world map.`;

export class MapHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.MAP, 'Failed to load map', {
      allowInHq: false,
      hqCommand: COMMANDS.MAP,
      missingCharacterMessage: 'Could not find your player.',
    });
  }

  protected async perform({ say, userId }: HandlerContext): Promise<void> {
    const player = this.player;
    if (!player) {
      return;
    }

    const { x, y } = player;
    if (typeof x !== 'number' || typeof y !== 'number') {
      await say({ text: 'Your location is unknown. Please try again later.' });
      return;
    }

    await sendPngMap(say, x, y, 8);

    const occupants = await getOccupantsSummaryAt(x, y, {
      currentSlackUserId: userId,
      currentSlackTeamId: this.teamId,
    });
    if (occupants) {
      await say({ text: occupants });
    }
  }

  protected getFriendlyError(error: unknown): string {
    const friendly = super.getFriendlyError(error);
    if (friendly === this.defaultErrorMessage) {
      return friendly;
    }
    return `Failed to load map: ${friendly}`;
  }
}

export const mapHandler = new MapHandler();
