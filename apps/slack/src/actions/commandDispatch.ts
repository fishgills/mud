import type { WebClient } from '@slack/web-api';
import { getAllHandlers } from '../handlers/handlerRegistry';
import { buildSayHelper } from './helpers';

export const dispatchCommandViaDM = async (
  client: WebClient,
  userId: string,
  command: string,
  teamId?: string,
) => {
  const handler = getAllHandlers()[command];
  if (!handler) return;
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (!channel) return;
  const say = buildSayHelper(client, channel);
  await handler({ userId, text: command, say, teamId });
};
