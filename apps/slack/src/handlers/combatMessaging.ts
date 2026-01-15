import type { WebClient } from '@slack/web-api';
import type { CombatResult } from '../dm-client';

const SLACK_TEXT_LIMIT = 3000;
const SLACK_BLOCKS_LIMIT = 50;

export type CombatPlayerMessage = NonNullable<
  CombatResult['playerMessages']
>[number];

const truncateText = (text: string, limit: number): string => {
  if (text.length <= limit) return text;
  const suffix = '...';
  return `${text.slice(0, limit - suffix.length)}${suffix}`;
};

const truncateTextObject = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return {
      ...record,
      text: truncateText(record.text, SLACK_TEXT_LIMIT),
    };
  }
  return value;
};

const truncateBlock = (
  block: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...block };
  if (typeof next.text === 'string') {
    next.text = truncateText(next.text, SLACK_TEXT_LIMIT);
  } else if (next.text && typeof next.text === 'object') {
    next.text = truncateTextObject(next.text);
  }
  if (Array.isArray(next.fields)) {
    next.fields = next.fields.map((field) => truncateTextObject(field));
  }
  if (Array.isArray(next.elements)) {
    next.elements = next.elements.map((element) =>
      truncateTextObject(element),
    );
  }
  if (next.label && typeof next.label === 'object') {
    next.label = truncateTextObject(next.label);
  }
  if (next.placeholder && typeof next.placeholder === 'object') {
    next.placeholder = truncateTextObject(next.placeholder);
  }
  return next;
};

const truncateBlocks = (
  blocks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> => {
  return blocks.slice(0, SLACK_BLOCKS_LIMIT).map((block) => truncateBlock(block));
};

const truncateSlackPayload = (
  message: string,
  blocks?: Array<Record<string, unknown>>,
): { text: string; blocks?: Array<Record<string, unknown>> } => {
  const text = truncateText(message, SLACK_TEXT_LIMIT);
  if (!blocks || blocks.length === 0) {
    return { text };
  }
  return { text, blocks: truncateBlocks(blocks) };
};

export const deliverCombatMessages = async (
  client: WebClient | undefined,
  messages: CombatResult['playerMessages'] | undefined,
): Promise<void> => {
  if (!client) return;
  if (!Array.isArray(messages) || messages.length === 0) return;

  const delivered = new Set<string>();

  for (const entry of messages) {
    if (!entry?.userId) continue;
    const slackKey = entry.teamId
      ? `${entry.teamId}:${entry.userId}`
      : entry.userId;

    if (delivered.has(slackKey)) continue;
    delivered.add(slackKey);

    const dm = await client.conversations.open({ users: entry.userId });
    const channelId =
      typeof dm.channel?.id === 'string' ? dm.channel.id : undefined;
    if (!channelId) continue;

    const payload = truncateSlackPayload(
      entry.message ?? 'Combat concluded.',
      Array.isArray(entry.blocks) ? entry.blocks : undefined,
    );

    await client.chat.postMessage({
      channel: channelId,
      text: payload.text,
      ...(Array.isArray(payload.blocks) && payload.blocks.length > 0
        ? { blocks: payload.blocks }
        : {}),
    });
  }
};
