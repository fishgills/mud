import type { App, BlockAction } from '@slack/bolt';
import { dmClient } from '../dm-client';
import { mapErrCodeToFriendlyMessage } from '../handlers/errorUtils';
import { getActionValue, getChannelIdFromBody } from './helpers';
import { buildItemActionMessage } from '../utils/itemDisplay';

export const registerInventoryActions = (app: App) => {
  app.action<BlockAction>(
    'inventory_equip',
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        body.team?.id ?? (context as { teamId?: string })?.teamId;
      const channelId = getChannelIdFromBody(body);
      const rawValue = getActionValue(body);
      if (!userId || !teamId || !rawValue) return;

      let payload: { playerItemId: number; allowedSlots?: string[] } | null =
        null;
      try {
        payload = JSON.parse(rawValue) as {
          playerItemId: number;
          allowedSlots?: string[];
        };
      } catch {
        const id = Number(rawValue);
        if (Number.isFinite(id))
          payload = { playerItemId: id, allowedSlots: [] };
      }

      if (!payload) return;

      const { playerItemId, allowedSlots = [] } = payload;
      const slot = allowedSlots[0];
      if (!slot) {
        const message = 'This item cannot be equipped.';
        if (channelId) {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: message,
          });
        } else {
          const dm = await client.conversations.open({ users: userId });
          const channel = dm.channel?.id;
          if (channel) await client.chat.postMessage({ channel, text: message });
        }
        return;
      }

      try {
        const res = await dmClient.equip({
          teamId,
          userId,
          playerItemId: Number(playerItemId),
          slot,
        });
        const resCode = (res as unknown as { code?: string })?.code;
        const friendly = mapErrCodeToFriendlyMessage(resCode);
        const successText = res.success
          ? buildItemActionMessage(
              'Equipped',
              res.data,
              res.message ?? `Equipped item ${playerItemId} to ${slot}`,
              { suffix: `to ${slot}` },
            )
          : undefined;
        const text = res.success
          ? successText ?? `Equipped item ${playerItemId} to ${slot}`
          : (friendly ??
            `Failed to equip: ${res.message ?? 'Unknown error'}`);
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
        app.logger.warn({ error }, 'inventory_equip handler failed');
        if (channelId) {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: `Failed to equip item ${playerItemId}`,
          });
          return;
        }
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

  app.action<BlockAction>(
    'inventory_unequip',
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        body.team?.id ?? (context as { teamId?: string })?.teamId;
      if (!teamId || !userId) {
        app.logger.warn(
          { userId, teamId },
          'Missing teamId or userId in inventory_unequip payload',
        );
        return;
      }
      const value = getActionValue(body);
      const channelId = getChannelIdFromBody(body);
      if (!userId || !value) return;
      try {
        const res = await dmClient.unequip({
          teamId,
          userId,
          playerItemId: Number(value),
        });
        const resCode = (res as unknown as { code?: string })?.code;
        const friendly = mapErrCodeToFriendlyMessage(resCode);
        const successText = res.success
          ? buildItemActionMessage(
              'Unequipped',
              res.data,
              res.message ?? `Unequipped item ${value}.`,
            )
          : undefined;
        const text = res.success
          ? successText ?? `Unequipped item ${value}.`
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
        app.logger.warn({ error }, 'inventory_unequip failed');
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
