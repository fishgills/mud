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
): Promise<boolean> {
  try {
    const url = new URL(env.WORLD_API_BASE_URL);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/render/map.png`;
    url.searchParams.set('x', String(x));
    url.searchParams.set('y', String(y));
    url.searchParams.set('p', String(16));
    const imageUrl = url.toString();
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

    return true;
  } catch (error) {
    console.info('Failed to send PNG map', error);
    return false;
  }
}
