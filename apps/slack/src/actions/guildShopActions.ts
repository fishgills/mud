import type { App, BlockAction } from '@slack/bolt';
import { GUILD_SHOP_ACTIONS, COMMANDS } from '../commands';
import { getActionValue } from './helpers';
import { dmClient } from '../dm-client';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const DEFAULT_BUY_ERROR =
  'Purchase failed. Make sure you are in the guild and the item is still in stock.';
const DEFAULT_SELL_ERROR =
  'Sale failed. Make sure the item is in your backpack while you are inside the guild.';

const resolveTeamId = (
  body: BlockAction,
  contextTeam?: string,
): string | undefined => {
  if (contextTeam) return contextTeam;
  const fromBody = (body as { team?: { id?: string } }).team?.id;
  if (typeof fromBody === 'string') {
    return fromBody;
  }
  const fromUser = (body.user as { team_id?: string } | undefined)?.team_id;
  return typeof fromUser === 'string' ? fromUser : undefined;
};

const getActionLabel = (body: BlockAction): string | undefined => {
  const rawAction = (body.actions && body.actions[0]) as
    | { text?: { text?: string } }
    | undefined;
  const text = rawAction?.text?.text;
  if (!text) return undefined;
  return text.replace(/^Buy\s+/i, '').trim() || text;
};

const notifyUser = async (
  client: App['client'],
  userId: string,
  message: string,
) => {
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (!channel) return;
  await client.chat.postMessage({
    channel,
    text: message,
  });
};

export const registerGuildShopActions = (app: App) => {
  app.action<BlockAction>(
    GUILD_SHOP_ACTIONS.BUY,
    async ({ ack, body, client, context, logger }) => {
      await ack();
      const userId = body.user?.id;
      const teamId = resolveTeamId(body, context.teamId as string | undefined);
      const sku = getActionValue(body);
      if (!userId || !sku || !teamId) return;
      const label = getActionLabel(body) ?? 'the selected item';
      try {
        const trade = await dmClient.guildBuyItem({ teamId, userId, sku });
        const cost = Math.abs(trade.goldDelta ?? 0);
        const message = `🛒 ${label} confirmed for ${cost} gold. Remaining gold: ${
          trade.remainingGold ?? 'unknown'
        }. Use \`${COMMANDS.CATALOG}\` anytime to refresh the shop list.`;
        await notifyUser(client, userId, message);
      } catch (error) {
        logger?.error?.(
          `Guild BUY failed for ${userId}: ${(error as Error).message}`,
        );
        const friendly = getUserFriendlyErrorMessage(error, DEFAULT_BUY_ERROR);
        await notifyUser(client, userId, friendly);
      }
    },
  );

  app.action<BlockAction>(
    GUILD_SHOP_ACTIONS.SELL,
    async ({ ack, body, client, context, logger }) => {
      await ack();
      const userId = body.user?.id;
      const teamId = resolveTeamId(body, context.teamId as string | undefined);
      const value = getActionValue(body);
      if (!userId || !value || !teamId) return;
      const playerItemId = Number(value);
      if (!Number.isFinite(playerItemId)) return;

      try {
        const trade = await dmClient.guildSellItem({
          teamId,
          userId,
          playerItemId,
        });
        const goldEarned = Math.abs(trade.goldDelta ?? 0);
        const itemDisplay = trade.itemName
          ? `${trade.itemName} (${trade.itemQuality ?? 'Common'})`
          : `item #${playerItemId}`;

        const message = `💰 Sold ${itemDisplay} for ${goldEarned} gold. Remaining gold: ${
          trade.remainingGold ?? 'unknown'
        }. Use \`${COMMANDS.INVENTORY}\` in the guild to see updated items.`;
        await notifyUser(client, userId, message);
      } catch (error) {
        logger?.error?.(
          `Guild SELL failed for ${userId}: ${(error as Error).message}`,
        );
        const friendly = getUserFriendlyErrorMessage(error, DEFAULT_SELL_ERROR);
        await notifyUser(client, userId, friendly);
      }
    },
  );
};
