import { worldSdk } from '../gql-client';
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
    // If we have a WORLD_BASE_URL configured, prefer sending an image block with a URL.
    if (env.WORLD_BASE_URL) {
      const url = new URL(env.WORLD_BASE_URL);
      // Our controller route is /render/map.png under the world global prefix.
      // WORLD_BASE_URL should already include the global prefix (e.g. http://host:3000/world)
      url.pathname = `${url.pathname.replace(/\/$/, '')}/render/map.png`;
      url.searchParams.set('x', String(x));
      url.searchParams.set('y', String(y));
      url.searchParams.set('p', String(pixelsPerTile));
      const imageUrl = url.toString();

      console.log(
        `sendPngMap via URL: x=${x} y=${y} p=${pixelsPerTile} url=${imageUrl}`,
      );
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
    }

    const t0 = Date.now();
    const tGqlStart = Date.now();
    const pngRes = await worldSdk.RenderPNGMap({ x, y, pixelsPerTile });
    const gqlMs = Date.now() - tGqlStart;
    const base64 = pngRes.renderMapPngBase64;
    if (!base64 || base64.length === 0) return false;
    const approxBytes = Math.round((base64.length * 3) / 4); // base64 -> bytes approximation
    const approxKB = Math.round(approxBytes / 102.4) / 10; // one decimal place
    const { randomUUID } = await import('crypto');
    const filename = `${randomUUID()}.png`;
    const tUploadStart = Date.now();
    await say({
      text: 'Map',
      fileUpload: {
        filename,
        contentBase64: base64,
      },
    });
    const uploadMs = Date.now() - tUploadStart;
    const totalMs = Date.now() - t0;
    console.log(
      `sendPngMap timing: x=${x} y=${y} p=${pixelsPerTile} gqlMs=${gqlMs} b64KB=${approxKB} uploadMs=${uploadMs} totalMs=${totalMs}`,
    );
    return true;
  } catch (e) {
    console.info('sendPngMap: failed to render/send PNG map:', e);
    return false;
  }
}
