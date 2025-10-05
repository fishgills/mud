import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { dmSdk } from '../gql-client';
import { COMMANDS } from '../commands';
import { sendPngMap } from './mapUtils';
import { toClientId } from '../utils/clientId';

export const mapHandlerHelp = `Display the ASCII map with "map". Example: Send "map" to see the world map.`;

export const mapHandler = async ({ say, userId }: HandlerContext) => {
  try {
    const result = await dmSdk.GetPlayer({
      slackId: toClientId(userId),
    });
    if (result.getPlayer.success && result.getPlayer.data) {
      const x = result.getPlayer.data.x;
      const y = result.getPlayer.data.y;

      await sendPngMap(say, x, y, 8);

      // After rendering the map, display any players at the same location
      try {
        const entities = await dmSdk.GetLocationEntities({ x, y });
        const playersHere = (entities.getPlayersAtLocation || []).filter(
          (p) => p.slackId !== toClientId(userId),
        );
        if (playersHere.length > 0) {
          await say({
            text: `You see the following players at your location: ${playersHere
              .map((p) => p.name)
              .join(', ')}`,
          });
        }
      } catch {
        // Non-critical; ignore errors fetching co-located players
      }
    }
  } catch (err) {
    await say({ text: `Failed to load map: ${err}` });
  }
};

registerHandler(COMMANDS.MAP, mapHandler);
