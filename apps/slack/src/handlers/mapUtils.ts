import { env } from '../env';
import type { SayMessage } from './types';
import { createLogger } from '@mud/logging';

const mapLog = createLogger('slack:handlers:map');

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
    const url = new URL(env.WORLD_API_BASE_URL);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/render/map.png`;
    url.searchParams.set('x', String(x));
    url.searchParams.set('y', String(y));
    url.searchParams.set('p', String(pixelsPerTile));
    const imageUrl = url.toString();
    mapLog.debug({ imageUrl }, 'Generated map image URL');
    const t0 = Date.now();
    await say({
      text: 'Map',
      blocks: [
        {
          type: 'image',
          image_url: imageUrl,
          alt_text: `Map at (${x}, ${y})`,
        },
      ],
    });
    const totalMs = Date.now() - t0;
    mapLog.info(
      { x, y, pixelsPerTile, imageUrl, totalMs },
      'sendPngMap via URL',
    );
    return true;
  } catch (e) {
    mapLog.error({ error: e, x, y }, 'sendPngMap failed to render/send PNG');
    return false;
  }
}
