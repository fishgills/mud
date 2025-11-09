import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { STAT_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';
import { PlayerAttribute } from '../dm-types';
import { buildPlayerStatsMessage } from '../handlers/stats/format';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const actionToAttribute: Record<string, PlayerAttribute> = {
  [STAT_ACTIONS.INCREASE_STRENGTH]: PlayerAttribute.Strength,
  [STAT_ACTIONS.INCREASE_AGILITY]: PlayerAttribute.Agility,
  [STAT_ACTIONS.INCREASE_HEALTH]: PlayerAttribute.Health,
};

export const registerStatActions = (app: App) => {
  for (const [actionId, attribute] of Object.entries(actionToAttribute)) {
    app.action<BlockAction>(
      actionId,
      async ({ ack, body, client, respond }) => {
        await ack();

        const userId = body.user?.id;
        const teamId = body.team?.id;
        if(!teamId || !userId) {
          throw new Error('Missing teamId or userId in action payload');
        }
        const channelId =
          body.channel?.id ||
          (typeof body.container?.channel_id === 'string'
            ? body.container.channel_id
            : undefined);
        const messageTs =
          (typeof body.message?.ts === 'string'
            ? body.message.ts
            : undefined) ||
          (typeof body.container?.message_ts === 'string'
            ? body.container.message_ts
            : undefined);

        if (!userId) return;

        try {
          const result = await dmClient.spendSkillPoint({
            teamId,
            userId,
            attribute,
          });
          if (!result.success || !result.data) {
            const errorText =
              result.message ?? 'Unable to spend a skill point right now.';
            if (respond) {
              await respond({
                text: errorText,
                response_type: 'ephemeral',
                replace_original: false,
              });
            }
            return;
          }

          if (channelId && messageTs) {
            const statsMessage = buildPlayerStatsMessage(result.data, {
              isSelf: true,
            });
            await client.chat.update({
              channel: channelId,
              ts: messageTs,
              text: statsMessage.text,
              blocks: statsMessage.blocks.filter(
                (block): block is KnownBlock => 'type' in block,
              ),
            });
          }
        } catch (err) {
          const errorMessage = getUserFriendlyErrorMessage(
            err,
            'Failed to spend a skill point',
          );
          if (respond) {
            await respond({
              text: errorMessage,
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
        }
      },
    );
  }
};
