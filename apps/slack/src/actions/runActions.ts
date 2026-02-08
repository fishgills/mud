import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { dmClient } from '../dm-client';
import { RUN_ACTIONS } from '../commands';
import { getActionContext, getActionValue, postToUser } from './helpers';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const parseRunId = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clearRunActionButtons = async (params: {
  client: App['client'];
  body: BlockAction;
  channelId?: string;
}) => {
  const { client, body, channelId } = params;
  const messageTs = body.container?.message_ts;
  const blocks = body.message?.blocks as KnownBlock[] | undefined;
  if (!channelId || !messageTs || !blocks?.length) return;
  const nextBlocks = blocks.filter((block) => block.type !== 'actions');
  if (nextBlocks.length === blocks.length) return;
  await client.chat.update({
    channel: channelId,
    ts: messageTs,
    blocks: nextBlocks,
    text: body.message?.text ?? 'Raid update',
  });
};

export const registerRunActions = (app: App) => {
  app.action<BlockAction>(
    RUN_ACTIONS.CONTINUE,
    async ({ ack, body, client, context }) => {
      await ack();
      const { userId, teamId, channelId } = getActionContext(body, context);
      const runId = parseRunId(getActionValue(body));

      if (!teamId || !userId) return;

      try {
        await clearRunActionButtons({ client, body, channelId });
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
      const { userId, teamId, channelId } = getActionContext(body, context);
      const runId = parseRunId(getActionValue(body));

      if (!teamId || !userId) return;

      try {
        await clearRunActionButtons({ client, body, channelId });
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
