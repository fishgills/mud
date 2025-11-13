import * as pureimage from 'pureimage';
import { PassThrough } from 'stream';

export type RenderBitmap = pureimage.Bitmap;

export function createRenderBitmap(
  width: number,
  height: number,
): RenderBitmap {
  return pureimage.make(width, height);
}

export async function bitmapToPngBuffer(bitmap: RenderBitmap): Promise<Buffer> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    pureimage.encodePNGToStream(bitmap, stream).catch(reject);
  });

  return Buffer.concat(chunks);
}

export async function bitmapToPngBase64(bitmap: RenderBitmap): Promise<string> {
  const buffer = await bitmapToPngBuffer(bitmap);
  return buffer.toString('base64');
}

export async function decodePngBase64(base64: string): Promise<RenderBitmap> {
  const stream = new PassThrough();
  stream.end(Buffer.from(base64, 'base64'));
  return pureimage.decodePNGFromStream(stream);
}
