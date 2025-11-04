import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import { dmClient } from '../dm-client';
import { mapErrCodeToFriendlyMessage } from '../handlers/errorUtils';
import { toClientId } from '../utils/clientId';
import { getActionValue, getChannelIdFromBody, getTriggerId } from './helpers';

export const registerInventoryActions = (app: App) => {
  app.action<BlockAction>('inventory_equip', async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    const triggerId = getTriggerId(body);
    const rawValue = getActionValue(body);
    if (!userId || !triggerId || !rawValue) return;

    let payload: { playerItemId: number; allowedSlots?: string[] } | null =
      null;
    try {
      payload = JSON.parse(rawValue) as {
        playerItemId: number;
        allowedSlots?: string[];
      };
    } catch {
      const id = Number(rawValue);
      if (Number.isFinite(id)) payload = { playerItemId: id, allowedSlots: [] };
    }

    if (!payload) return;

    const { playerItemId, allowedSlots = [] } = payload;
    const slotOptions = (
      allowedSlots.length > 0
        ? allowedSlots
        : ['head', 'chest', 'arms', 'legs', 'weapon']
    ).map((slot) => ({
      text: {
        type: 'plain_text' as const,
        text: slot[0].toUpperCase() + slot.slice(1),
      },
      value: slot,
    }));

    try {
      await client.views.open({
        trigger_id: triggerId,
        view: {
          type: 'modal',
          callback_id: 'inventory_equip_view',
          private_metadata: JSON.stringify({ playerItemId, userId }),
          title: { type: 'plain_text', text: 'Equip Item' },
          submit: { type: 'plain_text', text: 'Equip' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Choose a slot to equip item #${playerItemId}`,
              },
            },
            {
              type: 'input',
              block_id: 'slot_block',
              label: { type: 'plain_text', text: 'Slot' },
              element: {
                type: 'static_select',
                action_id: 'selected_slot',
                placeholder: { type: 'plain_text', text: 'Select a slot' },
                options: slotOptions,
              },
            },
          ],
        },
      });
    } catch (err) {
      console.warn('Failed to open equip modal', err);
      const dm = await client.conversations.open({ users: userId });
      const channel = dm.channel?.id;
      if (!channel) return;
      await client.chat.postMessage({
        channel,
        text: `To equip item ${playerItemId}, type: \`equip ${playerItemId} <slot>\``,
      });
    }
  });

  app.view<ViewSubmitAction>(
    'inventory_equip_view',
    async ({ ack, view, client }) => {
      await ack();
      const meta = view.private_metadata
        ? JSON.parse(view.private_metadata)
        : null;
      const playerItemId = meta?.playerItemId;
      const userId = meta?.userId;
      if (!playerItemId || !userId) return;
      const slot = view.state.values?.slot_block?.selected_slot?.selected_option
        ?.value as string | undefined;
      if (!slot) return;

      try {
        const res = await dmClient.equip({
          slackId: toClientId(userId),
          playerItemId: Number(playerItemId),
          slot,
        });
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          const resCode = (res as unknown as { code?: string })?.code;
          const friendly = mapErrCodeToFriendlyMessage(resCode);
          const text = res.success
            ? `Equipped item ${playerItemId} to ${slot}`
            : (friendly ??
              `Failed to equip: ${res.message ?? 'Unknown error'}`);
          await client.chat.postMessage({ channel, text });
        }
      } catch (error) {
        console.warn('inventory_equip_view handler failed', error);
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          await client.chat.postMessage({
            channel,
            text: `Failed to equip item ${playerItemId}`,
          });
        }
      }
    },
  );

  app.action<BlockAction>('inventory_drop', async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    const value = getActionValue(body);
    const channelId = getChannelIdFromBody(body);
    if (!userId || !value) return;
    try {
      const res = await dmClient.drop({
        slackId: toClientId(userId),
        playerItemId: Number(value),
      });
      const resCode = (res as unknown as { code?: string })?.code;
      const friendly = mapErrCodeToFriendlyMessage(resCode);
      const text = res.success
        ? `Dropped item ${value}.`
        : (friendly ?? `Failed to drop: ${res.message ?? 'Unknown error'}`);
      if (channelId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text,
        });
      } else {
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) await client.chat.postMessage({ channel, text });
      }
    } catch (error) {
      console.warn('inventory_drop failed', error);
      if (channelId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: 'Failed to drop item',
        });
      }
    }
  });

  app.action<BlockAction>(
    'inventory_unequip',
    async ({ ack, body, client }) => {
      await ack();
      const userId = body.user?.id;
      const value = getActionValue(body);
      const channelId = getChannelIdFromBody(body);
      if (!userId || !value) return;
      try {
        const res = await dmClient.unequip({
          slackId: toClientId(userId),
          playerItemId: Number(value),
        });
        const resCode = (res as unknown as { code?: string })?.code;
        const friendly = mapErrCodeToFriendlyMessage(resCode);
        const text = res.success
          ? `Unequipped item ${value}.`
          : (friendly ??
            `Failed to unequip: ${res.message ?? 'Unknown error'}`);
        if (channelId) {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text,
          });
        } else {
          const dm = await client.conversations.open({ users: userId });
          const channel = dm.channel?.id;
          if (channel) await client.chat.postMessage({ channel, text });
        }
      } catch (error) {
        console.warn('inventory_unequip failed', error);
        if (channelId) {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: 'Failed to unequip item',
          });
        }
      }
    },
  );
};
