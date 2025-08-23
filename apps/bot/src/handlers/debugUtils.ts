import { SayMessage } from './types';

/**
 * Send a JSON payload as a code block, or as a file upload if it's large.
 */
export async function sendDebugJson(
  say: (msg: SayMessage) => Promise<void>,
  data: unknown,
  opts?: { filename?: string; title?: string },
): Promise<void> {
  const { filename = 'result.json', title = 'Result' } = opts || {};
  const debugJson = JSON.stringify(data, null, 2);
  if (debugJson.length > 2500) {
    await say({
      text: `${title} attached as JSON for debugging.`,
      fileUpload: {
        filename,
        title,
        filetype: 'json',
        contentBase64: Buffer.from(debugJson, 'utf-8').toString('base64'),
      },
    });
  } else {
    await say({ text: '```' + debugJson + '```' });
  }
}
