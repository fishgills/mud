import type { WebClient } from '@slack/web-api';
import type { CombatResult } from '../dm-client';
import { createLogger } from '@mud/logging';

const combatMessagingLog = createLogger('slack:handlers:combat-messaging');

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
    if (!entry?.userId) continue;
    const slackKey = entry.teamId
      ? `${entry.teamId}:${entry.userId}`
      : entry.userId;

    if (delivered.has(slackKey)) continue;
    delivered.add(slackKey);

    try {
      const dm = await client.conversations.open({ users: entry.userId });
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
      combatMessagingLog.warn(
        { slackKey, error },
        'Failed to deliver combat message',
      );
    }
  }
};
