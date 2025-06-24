import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { worldSdk } from '../gql-client';

const EMOJI_MAP = ':map:';

export const mapHandlerHelp = `Display the ASCII map with ${EMOJI_MAP}. Example: Send ${EMOJI_MAP} to see the world map.`;

export const mapHandler = async ({ say }: HandlerContext) => {
  try {
    // Call the generated SDK for the world service
    const data = await worldSdk.RenderAscii();
    // Render a simple ASCII map from the tile symbols
    const rows = data.renderMapTiles
      .map((row) => row.map((tile) => tile.symbol || '.').join(''))
      .join('\n');
    await say({ text: `\n\`\`\`\n${rows}\n\`\`\`` });
  } catch (err) {
    await say({ text: `Failed to load map: ${err}` });
  }
};

registerHandler(EMOJI_MAP, mapHandler);
