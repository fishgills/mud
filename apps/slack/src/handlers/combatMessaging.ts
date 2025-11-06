import type { WebClient } from '@slack/web-api';
import type { CombatResult } from '../dm-client';

export type CombatPlayerMessage = NonNullable<
  CombatResult['playerMessages']
>[number];

export const deliverCombatMessages = async (
  client: WebClient | undefined,
  messages: CombatResult['playerMessages'] | undefined,
): Promise<void> => {
  if (!client) return;
  if (!Array.isArray(messages) || messages.length === 0) return;

  const delivered = new Set<string>();

  for (const entry of messages) {
    const slackId = entry?.slackId;
    if (!slackId || delivered.has(slackId)) continue;
    delivered.add(slackId);

    try {
      const dm = await client.conversations.open({ users: slackId });
      const channelId =
        typeof dm.channel?.id === 'string' ? dm.channel.id : undefined;
      if (!channelId) continue;

      await client.chat.postMessage({
        channel: channelId,
        text: entry.message ?? 'Combat concluded.',
        ...(Array.isArray(entry.blocks) && entry.blocks.length > 0
          ? { blocks: entry.blocks }
          : {}),
      });
    } catch (error) {
      console.warn('Failed to deliver combat message', {
        slackId,
        error,
      });
    }
  }
};
