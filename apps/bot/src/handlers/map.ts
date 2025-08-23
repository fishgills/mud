import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { dmSdk, worldSdk } from '../gql-client';
import { COMMANDS } from '../commands';

export const mapHandlerHelp = `Display the ASCII map with "map". Example: Send "map" to see the world map.`;

export const mapHandler = async ({ say, userId }: HandlerContext) => {
  try {
    const result = await dmSdk.GetPlayer({ slackId: userId });
    if (result.getPlayer.success && result.getPlayer.data) {
      const x = result.getPlayer.data.x;
      const y = result.getPlayer.data.y;

      // Try to fetch PNG map and upload to Slack
      try {
        const pngRes = await worldSdk.RenderPNGMap({ x, y, pixelsPerTile: 8 });
        const base64 = pngRes.renderMapPngBase64;
        if (base64 && base64.length > 0) {
          await say({
            text: `Map centered at (${x}, ${y})`,
            fileUpload: {
              filename: `map_${x}_${y}.png`,
              contentBase64: base64,
              title: 'World Map',
              filetype: 'png',
            },
          });
          return;
        }
      } catch (_e) {
        console.info('Failed to render PNG map:', _e);
      }

      // Fallback: ASCII map with center marked as 'X'
      const ascii = await worldSdk.RenderAscii({ x, y });
      const totalRows = ascii.renderMapTiles.length;
      const totalCols = ascii.renderMapTiles[0]?.length ?? 0;
      const centerRow = Math.floor(totalRows / 2);
      const centerCol = Math.floor(totalCols / 2);
      const rows = ascii.renderMapTiles
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
