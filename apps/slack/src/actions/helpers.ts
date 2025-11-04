import type { ViewStateValue } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import type { HandlerContext, SayMessage } from '../handlers/types';
import type { KnownBlock } from '@slack/types';

export type SlackBlockState = Record<string, Record<string, ViewStateValue>>;

export const getActionValue = (body: unknown): string | undefined => {
  const b = body as { actions?: Array<Record<string, unknown>> | undefined };
  const a = b.actions && b.actions[0];
  if (!a) return undefined;
  const v = (a as { value?: unknown }).value;
  return typeof v === 'string' ? v : undefined;
};

export const getTriggerId = (body: unknown): string | undefined => {
  return (body as { trigger_id?: unknown }).trigger_id as string | undefined;
};

export const getChannelIdFromBody = (body: unknown): string | undefined => {
  const b = body as {
    channel?: { id?: unknown } | undefined;
    container?: { channel_id?: unknown } | undefined;
  };
  if (b.channel && typeof b.channel.id === 'string') return b.channel.id;
  if (b.container && typeof b.container.channel_id === 'string') {
    return b.container.channel_id;
  }
  return undefined;
};

export const buildSayHelper =
  (client: WebClient, channel: string): HandlerContext['say'] =>
  async (msg: SayMessage) => {
    if (msg.fileUpload && client.files?.uploadV2) {
      const buffer = Buffer.from(msg.fileUpload.contentBase64, 'base64');
      await client.files.uploadV2({
        channel_id: channel,
        filename: msg.fileUpload.filename,
        file: buffer,
        initial_comment: msg.text ?? undefined,
      });
      return;
    }

    if (msg.blocks && msg.blocks.length > 0) {
      const knownBlocks = msg.blocks.filter(
        (block): block is KnownBlock => 'type' in block,
      );
      await client.chat.postMessage({
        channel,
        text: msg.text ?? '',
        blocks: knownBlocks,
      });
      return;
    }

    if (msg.text) {
      await client.chat.postMessage({ channel, text: msg.text });
      return;
    }

    await client.chat.postMessage({ channel, text: '' });
  };
