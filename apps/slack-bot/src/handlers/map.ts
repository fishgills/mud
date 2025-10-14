import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { sendPngMap } from './mapUtils';
import { getOccupantsSummaryAt } from './locationUtils';
import { PlayerCommandHandler } from './base';

export const mapHandlerHelp = `Display the ASCII map with "map". Example: Send "map" to see the world map.`;

export class MapHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.MAP, 'Failed to load map');
  }

  protected async perform({ say, userId }: HandlerContext): Promise<void> {
    const clientId = this.toClientId(userId);
    const result = await this.dm.getPlayer({
      slackId: clientId,
    });
    if (!result.success || !result.data) {
      await say({ text: 'Could not find your player.' });
      return;
    }

    const { x, y } = result.data;
    if (typeof x !== 'number' || typeof y !== 'number') {
      await say({ text: 'Your location is unknown. Please try again later.' });
      return;
    }

    await sendPngMap(say, x, y, 8);

    const occupants = await getOccupantsSummaryAt(x, y, {
      currentSlackUserId: userId,
      currentClientId: clientId,
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
