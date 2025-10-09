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
    const result = await this.sdk.GetPlayer({
      slackId: this.toClientId(userId),
    });
    if (!result.getPlayer.success || !result.getPlayer.data) {
      await say({ text: 'Could not find your player.' });
      return;
    }

    const { x, y } = result.getPlayer.data;
    await sendPngMap(say, x, y, 8);

    const occupants = await getOccupantsSummaryAt(x, y, userId);
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
