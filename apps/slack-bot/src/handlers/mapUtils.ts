import { env } from '../env';
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
    const url = new URL(env.WORLD_BASE_URL);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/render/map.png`;
    url.searchParams.set('x', String(x));
    url.searchParams.set('y', String(y));
    url.searchParams.set('p', String(pixelsPerTile));
    const imageUrl = url.toString();
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
    console.log(
      `sendPngMap via URL: x=${x} y=${y} p=${pixelsPerTile} url=${imageUrl} postMs=${totalMs}`,
    );
    return true;
  } catch (e) {
    console.info('sendPngMap: failed to render/send PNG map:', e);
    return false;
  }
}
