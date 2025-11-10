import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import {
  getUserFriendlyErrorMessage,
  mapErrCodeToFriendlyMessage,
} from '../handlers/errorUtils';
import { dmClient } from '../dm-client';
import { PICKUP_ACTIONS, COMMANDS } from '../commands';
import { ITEM_SELECTION_BLOCK_ID } from '../handlers/pickup';
import type { SlackBlockState } from './helpers';
import type { ItemRecord } from '../dm-client';

const formatQualityLabel = (quality: unknown): string | null => {
  if (typeof quality !== 'string') return null;
  const normalized = quality.replace(/[_\s]+/g, ' ').trim();
  if (!normalized) return null;
  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildBlocksWithPickupInProgress = (
  blocks: KnownBlock[] | undefined,
  progressText: string,
): KnownBlock[] | null => {
  if (!blocks) return null;

  let changed = false;
  const updatedBlocks: KnownBlock[] = [];

  for (const block of blocks) {
    if (
      block.type === 'actions' &&
      block.block_id === ITEM_SELECTION_BLOCK_ID
    ) {
      changed = true;
      updatedBlocks.push({
        type: 'section',
        block_id: ITEM_SELECTION_BLOCK_ID,
        text: { type: 'mrkdwn', text: progressText },
      });
      continue;
    }
    updatedBlocks.push(block);
  }

  return changed ? updatedBlocks : null;
};

export const registerPickupActions = (app: App) => {
  app.action(PICKUP_ACTIONS.ITEM_SELECT, async ({ ack }) => {
    await ack();
  });

  app.action<BlockAction>(
    PICKUP_ACTIONS.PICKUP,
    async ({ ack, body, client, context }) => {
      await ack();

      const userId = body.user?.id;
      const teamId =
        body.team?.id ?? (context as { teamId?: string })?.teamId;
      if (!teamId || !userId) {
        app.logger.warn(
          { userId, teamId },
          'Missing teamId or userId in pickup action payload',
        );
        return;
      }
      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        typeof body.message?.ts === 'string'
          ? body.message.ts
          : typeof body.container?.message_ts === 'string'
            ? body.container.message_ts
            : undefined;
      const messageBlocks =
        (body.message?.blocks as KnownBlock[] | undefined) ?? undefined;

      if (!userId) return;

      const values = body.state?.values as SlackBlockState | undefined;
      let selectedValue: string | undefined;
      let selectedText: string | undefined;

      if (values) {
        for (const block of Object.values(values)) {
          const sel = block[PICKUP_ACTIONS.ITEM_SELECT];
          const opt = sel?.selected_option;
          if (opt?.value) {
            selectedValue = opt.value as string;
            selectedText = (opt.text?.text as string) || undefined;
            break;
          }
        }
      }

      if (!selectedValue) {
        if (channelId) {
          await client.chat.postMessage({
            channel: channelId,
            text: 'Please select an item to pick up first!',
          });
        }
        return;
      }

      if (channelId && messageTs) {
        const progressText = 'Picking up item...';
        const updatedBlocks = buildBlocksWithPickupInProgress(
          messageBlocks,
          progressText,
        );
        if (updatedBlocks) {
          try {
            await client.chat.update({
              channel: channelId,
              ts: messageTs,
              text: progressText,
              blocks: updatedBlocks,
            });
          } catch (err) {
            app.logger.warn(
              { error: err },
              'Failed to update pickup button state',
            );
          }
        }
      }

      let worldItemId: number | undefined;
      if (selectedValue.startsWith('W:')) {
        const idPart = selectedValue.slice(2);
        const idNum = Number(idPart);
        if (Number.isFinite(idNum)) worldItemId = idNum;
      }

      try {
        const pickupResult = await dmClient.pickup({
          teamId,
          userId,
          worldItemId,
        });
        if (!pickupResult || !pickupResult.success) {
          const resCode = (pickupResult as unknown as { code?: string })?.code;
          const friendly = mapErrCodeToFriendlyMessage(resCode);
          const text =
            friendly ??
            (pickupResult?.message as string) ??
            'Failed to pick up item.';
          if (channelId) {
            await client.chat.postMessage({ channel: channelId, text });
          }
          return;
        }

        const typedPickup = pickupResult as unknown as {
          item?: ItemRecord;
          data?: { item?: ItemRecord } | undefined;
        };
        const itemFromRes = typedPickup.item ?? typedPickup.data?.item;
        let itemName = selectedText ?? 'an item';
        let quantity: number | undefined = undefined;
        if (itemFromRes) {
          const baseName = itemFromRes.itemName ?? itemFromRes.name ?? itemName;
          const quality = itemFromRes.quality ?? undefined;
          if (typeof baseName === 'string') {
            const qualityLabel = formatQualityLabel(quality);
            itemName = qualityLabel ? `${qualityLabel} ${baseName}` : baseName;
          }
          if (typeof itemFromRes.quantity === 'number')
            quantity = itemFromRes.quantity;
        }

        const pickerDm = await client.conversations.open({ users: userId });
        const pickerChannel = pickerDm.channel?.id;
        if (pickerChannel) {
          const qtyText =
            typeof quantity === 'number' && quantity > 1
              ? `${quantity} × ${itemName}`
              : itemName;
          await client.chat.postMessage({
            channel: pickerChannel,
            text: `You have picked up ${qtyText}. Check your \`${COMMANDS.INVENTORY}\` next.`,
          });
        }

        const playerRes = await dmClient.getPlayer({
          teamId,
          userId,
        });
        const player = playerRes.data;
        const playerName = player?.name ?? 'Someone';
        const x = player?.x;
        const y = player?.y;
        if (typeof x === 'number' && typeof y === 'number') {
          const loc = await dmClient.getLocationEntities({ x, y });
        for (const p of loc.players || []) {
          const record = p as unknown as Record<string, unknown>;
          const directUserId =
            typeof record.userId === 'string' ? record.userId : null;
          const slackId =
            typeof record.slackId === 'string' ? record.slackId : null;
          const derivedUserId = slackId ? slackId.split(':').pop() : null;
          const targetUser = directUserId ?? derivedUserId;
          if (!targetUser || targetUser === userId) continue;
          try {
            const dm = await client.conversations.open({ users: targetUser });
            const ch = dm.channel?.id;
            if (ch) {
              await client.chat.postMessage({
                channel: ch,
                text: `${playerName} picked something up from the ground.`,
                });
              }
            } catch {
              // ignore individual DM failures
            }
          }
        }
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Failed to pick up item',
        );
        if (channelId) {
          await client.chat.postMessage({ channel: channelId, text: message });
        }
      }
    },
  );
};
