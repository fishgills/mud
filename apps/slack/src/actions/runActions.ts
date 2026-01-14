import type { App, BlockAction } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import { dmClient } from '../dm-client';
import { RUN_ACTIONS } from '../commands';
import { getActionValue, getChannelIdFromBody } from './helpers';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const parseRunId = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const postToUser = async (params: {
  client: WebClient;
  userId?: string;
  channelId?: string;
  text: string;
}) => {
  const { client, userId, channelId, text } = params;
  if (channelId) {
    await client.chat.postMessage({ channel: channelId, text });
    return;
  }
  if (!userId) return;
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (channel) {
    await client.chat.postMessage({ channel, text });
  }
};

export const registerRunActions = (app: App) => {
  app.action<BlockAction>(
    RUN_ACTIONS.CONTINUE,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        body.team?.id ?? (context as { teamId?: string })?.teamId;
      const channelId = getChannelIdFromBody(body);
      const runId = parseRunId(getActionValue(body));

      if (!teamId || !userId) return;

      try {
        const result = await dmClient.continueRun({
          teamId,
          userId,
          runId,
        });
        if (!result.success) {
          await postToUser({
            client,
            userId,
            channelId,
            text: result.message ?? 'Unable to continue the raid.',
          });
          return;
        }
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to continue the raid.',
        );
        await postToUser({ client, userId, channelId, text: message });
      }
    },
  );

  app.action<BlockAction>(
    RUN_ACTIONS.FINISH,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        body.team?.id ?? (context as { teamId?: string })?.teamId;
      const channelId = getChannelIdFromBody(body);
      const runId = parseRunId(getActionValue(body));

      if (!teamId || !userId) return;

      try {
        const result = await dmClient.finishRun({
          teamId,
          userId,
          runId,
        });
        if (!result.success) {
          await postToUser({
            client,
            userId,
            channelId,
            text: result.message ?? 'Unable to finish the raid.',
          });
          return;
        }
        await postToUser({
          client,
          userId,
          channelId,
          text: 'Raid cashed out. Rewards are on the way.',
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to finish the raid.',
        );
        await postToUser({ client, userId, channelId, text: message });
      }
    },
  );
};
