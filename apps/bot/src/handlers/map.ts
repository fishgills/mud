import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { dmSdk, worldSdk } from '../gql-client';
import { COMMANDS } from '../commands';

export const mapHandlerHelp = `Display the ASCII map with "map". Example: Send "map" to see the world map.`;

export const mapHandler = async ({ say, userId }: HandlerContext) => {
  try {
    const result = await dmSdk.GetPlayer({ slackId: userId });
    if (result.getPlayer.success && result.getPlayer.data) {
      // Call the generated SDK for the world service
      const data = await worldSdk.RenderAscii({
        x: result.getPlayer.data?.x,
        y: result.getPlayer.data?.y,
      });

      // Determine center indices
      const totalRows = data.renderMapTiles.length;
      const totalCols = data.renderMapTiles[0]?.length ?? 0;
      const centerRow = Math.floor(totalRows / 2);
      const centerCol = Math.floor(totalCols / 2);

      // Render a simple ASCII map from the tile symbols, placing an 'X' at the center
      const rows = data.renderMapTiles
        .map((row, rIdx) =>
          row
            .map((tile, cIdx) =>
              rIdx === centerRow && cIdx === centerCol
                ? 'X'
                : tile.symbol || '.',
            )
            .join(''),
        )
        .join('\n');
      await say({ text: `\n\`\`\`\n${rows}\n\`\`\`` });
    }
  } catch (err) {
    await say({ text: `Failed to load map: ${err}` });
  }
};

registerHandler(COMMANDS.MAP, mapHandler);
