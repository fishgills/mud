import type { App, BlockAction } from '@slack/bolt';
import { dmClient } from '../dm-client';
import { mapErrCodeToFriendlyMessage } from '../handlers/errorUtils';
import { getActionContext, getActionValue, postEphemeralOrDm } from './helpers';
import { buildItemActionMessage } from '../utils/itemDisplay';

export const registerInventoryActions = (app: App) => {
  app.action<BlockAction>(
    'inventory_equip',
    async ({ ack, body, client, context }) => {
      await ack();
      const { userId, teamId, channelId } = getActionContext(body, context);
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
        await postEphemeralOrDm({
          client,
          userId,
          channelId,
          text: 'This item cannot be equipped.',
        });
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
          ? (successText ?? `Equipped item ${playerItemId} to ${slot}`)
          : (friendly ?? `Failed to equip: ${res.message ?? 'Unknown error'}`);
        await postEphemeralOrDm({ client, userId, channelId, text });
      } catch (error) {
        app.logger.warn({ error }, 'inventory_equip handler failed');
        await postEphemeralOrDm({
          client,
          userId,
          channelId,
          text: `Failed to equip item ${playerItemId}`,
        });
      }
    },
  );

  app.action<BlockAction>(
    'inventory_unequip',
    async ({ ack, body, client, context }) => {
      await ack();
      const { userId, teamId, channelId } = getActionContext(body, context);
      if (!teamId || !userId) {
        app.logger.warn(
          { userId, teamId },
          'Missing teamId or userId in inventory_unequip payload',
        );
        return;
      }
      const value = getActionValue(body);
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
          ? (successText ?? `Unequipped item ${value}.`)
          : (friendly ??
            `Failed to unequip: ${res.message ?? 'Unknown error'}`);
        await postEphemeralOrDm({ client, userId, channelId, text });
      } catch (error) {
        app.logger.warn({ error }, 'inventory_unequip failed');
        await postEphemeralOrDm({
          client,
          userId,
          channelId,
          text: 'Failed to unequip item',
        });
      }
    },
  );
};
