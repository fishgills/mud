import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { ATTACK_ACTIONS } from '../commands';
import { dmClient, type AttackInput } from '../dm-client';
import { AttackOrigin, TargetType } from '../dm-types';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import {
  MONSTER_SELECTION_BLOCK_ID,
  SELF_ATTACK_ERROR,
} from '../handlers/attack';
import {
  buildAttackFailureMessage,
  isMissingTargetCharacterMessage,
  notifyTargetAboutMissingCharacter,
} from '../handlers/attackNotifications';
import type { SlackBlockState } from './helpers';

type SelectedTarget =
  | { kind: 'monster'; id: number; name: string }
  | { kind: 'player'; slackId: string; name: string };

const extractSelectedTarget = (
  values: SlackBlockState | undefined,
): SelectedTarget | null => {
  if (!values) return null;

  for (const block of Object.values(values)) {
    const selection = block[ATTACK_ACTIONS.MONSTER_SELECT];
    const option = selection?.selected_option;
    if (!option?.value) continue;

    const raw = option.value as string;
    const text = option.text?.text?.trim() || '';

    if (raw.startsWith('M:')) {
      const idPart = raw.slice(2);
      const idNum = Number(idPart);
      if (!Number.isNaN(idNum)) {
        return {
          kind: 'monster',
          id: idNum,
          name: text.replace(/^Monster:\s*/i, '') || 'the monster',
        };
      }
    }

    if (raw.startsWith('P:')) {
      const slackId = raw.slice(2);
      if (slackId) {
        return {
          kind: 'player',
          slackId,
          name: text.replace(/^Player:\s*/i, '') || 'the player',
        };
      }
    }
  }

  return null;
};

const buildBlocksWithAttackInProgress = (
  blocks: KnownBlock[] | undefined,
  progressText: string,
): KnownBlock[] | null => {
  if (!blocks) return null;

  let changed = false;
  const updatedBlocks: KnownBlock[] = [];

  for (const block of blocks) {
    if (
      block.type === 'actions' &&
      block.block_id === MONSTER_SELECTION_BLOCK_ID
    ) {
      changed = true;
      updatedBlocks.push({
        type: 'section',
        block_id: MONSTER_SELECTION_BLOCK_ID,
        text: {
          type: 'mrkdwn',
          text: progressText,
        },
      });
      continue;
    }
    updatedBlocks.push(block);
  }

  return changed ? updatedBlocks : null;
};

export const registerAttackActions = (app: App) => {
  app.action<BlockAction>(ATTACK_ACTIONS.MONSTER_SELECT, async ({ ack }) => {
    await ack();
  });

  app.action<BlockAction>(
    ATTACK_ACTIONS.ATTACK_MONSTER,
    async ({ ack, body, client, context }) => {
      await ack();

      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
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

      if (!userId || !channelId) return;

      const selected = extractSelectedTarget(
        body.state?.values as SlackBlockState | undefined,
      );

      if (!selected) {
        await client.chat.postMessage({
          channel: channelId,
          text: 'Please select a monster to attack first!',
        });
        return;
      }

      if (channelId && messageTs) {
        const targetName = selected.name || 'target';
        const attackProgressText = `Attacking ${targetName}...`;
        const updatedBlocks = buildBlocksWithAttackInProgress(
          messageBlocks,
          attackProgressText,
        );
        if (updatedBlocks) {
          try {
            await client.chat.update({
              channel: channelId,
              ts: messageTs,
              text: attackProgressText,
              blocks: updatedBlocks,
            });
          } catch (err) {
            console.warn('Failed to update attack button state', err);
          }
        }
      }

      try {
        const isMonster = selected.kind === 'monster';
        const attackOrigin = isMonster
          ? AttackOrigin.TextPve
          : AttackOrigin.DropdownPvp;
        if (!isMonster && selected.slackId === userId) {
          await client.chat.postMessage({
            channel: channelId,
            text: SELF_ATTACK_ERROR,
          });
          return;
        }

        const attackInput: AttackInput = isMonster
          ? {
              targetType: TargetType.Monster,
              targetId: selected.id,
              attackOrigin,
            }
          : {
              targetType: TargetType.Player,
              targetSlackId: selected.slackId,
              attackOrigin,
            };

        const attackResult = await dmClient.attack({
          teamId,
          userId,
          input: attackInput,
        });

        if (!attackResult.success) {
          const failureText = buildAttackFailureMessage(attackResult.message, {
            targetKind: selected.kind,
            targetName: selected.name,
          });
          await client.chat.postMessage({
            channel: channelId,
            text: failureText,
          });

          if (
            selected.kind === 'player' &&
            selected.slackId !== userId &&
            isMissingTargetCharacterMessage(attackResult.message)
          ) {
            await notifyTargetAboutMissingCharacter(
              client,
              userId,
              selected.slackId,
            );
          }
          return;
        }

        const combat = attackResult.data;
        if (!combat) {
          await client.chat.postMessage({
            channel: channelId,
            text: 'Attack succeeded but no combat data returned.',
          });
          return;
        }

        // Removed direct initiation and DM delivery; event bus handles participant notifications
      } catch (err) {
        const message = getUserFriendlyErrorMessage(err, 'Failed to attack');
        await client.chat.postMessage({ channel: channelId, text: message });
      }
    },
  );
};
