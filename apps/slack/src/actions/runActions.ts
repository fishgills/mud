import type { App, BlockAction } from '@slack/bolt';
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
  app: App;
  userId?: string;
  channelId?: string;
  text: string;
}) => {
  const { app, userId, channelId, text } = params;
  if (channelId) {
    await app.client.chat.postMessage({ channel: channelId, text });
    return;
  }
  if (!userId) return;
  const dm = await app.client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (channel) {
    await app.client.chat.postMessage({ channel, text });
  }
};

export const registerRunActions = (app: App) => {
  app.action<BlockAction>(
    RUN_ACTIONS.CONTINUE,
    async ({ ack, body, context }) => {
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
            app,
            userId,
            channelId,
            text: result.message ?? 'Unable to continue the run.',
          });
          return;
        }
        await postToUser({
          app,
          userId,
          channelId,
          text: 'Continuing the run. Check your DMs for the next round.',
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to continue the run.',
        );
        await postToUser({ app, userId, channelId, text: message });
      }
    },
  );

  app.action<BlockAction>(
    RUN_ACTIONS.FINISH,
    async ({ ack, body, context }) => {
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
            app,
            userId,
            channelId,
            text: result.message ?? 'Unable to finish the run.',
          });
          return;
        }
        await postToUser({
          app,
          userId,
          channelId,
          text: 'Run cashed out. Rewards are on the way.',
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to finish the run.',
        );
        await postToUser({ app, userId, channelId, text: message });
      }
    },
  );
};
