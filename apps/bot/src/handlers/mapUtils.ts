import { worldSdk } from '../gql-client';
import type { SayMessage } from './types';

/**
 * Attempts to render and send a PNG map centered on (x, y).
 * Returns true on success, false if rendering or upload failed.
 */
export async function sendPngMap(
  say: (msg: SayMessage) => Promise<void>,
  x: number,
  y: number,
  pixelsPerTile = 8,
): Promise<boolean> {
  try {
    const pngRes = await worldSdk.RenderPNGMap({ x, y, pixelsPerTile });
    const base64 = pngRes.renderMapPngBase64;
    if (!base64 || base64.length === 0) return false;
    const { randomUUID } = await import('crypto');
    const filename = `${randomUUID()}.png`;
    await say({
      text: 'Map',
      fileUpload: {
        filename,
        contentBase64: base64,
      },
    });
    return true;
  } catch (e) {
    console.info('sendPngMap: failed to render PNG map:', e);
    return false;
  }
}
