import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { ATTACK_ACTIONS, COMMANDS } from '../commands';
import { dmClient } from '../dm-client';
import { TargetType } from '../dm-types';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import {
  MONSTER_SELECTION_BLOCK_ID,
  SELF_ATTACK_ERROR,
} from '../handlers/attack';
import { toClientId } from '../utils/clientId';
import type { SlackBlockState } from './helpers';

type SelectedTarget =
  | { kind: 'monster'; id: number; name: string }
  | { kind: 'player'; slackId: string; name: string };

const buildAttackFailureMessage = (
  rawMessage: string | undefined | null,
  selection: SelectedTarget | null,
): string => {
  const fallback = rawMessage
    ? `Attack failed: ${rawMessage}`
    : 'Attack failed.';
  if (!selection || selection.kind !== 'player') {
    return fallback;
  }

  const message = (rawMessage ?? '').toLowerCase();
  if (!message) {
    return fallback;
  }

  const targetName = selection.name?.trim() || 'that player';

  if (message.includes('not alive')) {
    return `${targetName} is down right now. Wait for them to respawn before trying again.`;
  }

  if (
    message.includes('no valid identifier') ||
    message.includes('not found')
  ) {
    return `Couldn't find a character for ${targetName}. Ask them to check in with the bot using "/mud ${COMMANDS.LOOK}" or create one with "/mud ${COMMANDS.NEW} <name>".`;
  }

  return fallback;
};

const isMissingTargetCharacterMessage = (
  rawMessage: string | undefined | null,
): boolean => {
  const message = rawMessage?.toLowerCase() ?? '';
  if (!message) return false;
  if (message.includes('target player not found')) return true;
  if (message.includes('player not found')) return true;
  if (message.includes('no valid identifier')) return true;
  if (message.includes('no character')) return true;
  return false;
};

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
    async ({ ack, body, client }) => {
      await ack();

      const userId = body.user?.id;
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
        if (!isMonster && selected.slackId === userId) {
          await client.chat.postMessage({
            channel: channelId,
            text: SELF_ATTACK_ERROR,
          });
          return;
        }

        const attackResult = await dmClient.attack({
          slackId: toClientId(userId),
          input: isMonster
            ? { targetType: TargetType.Monster, targetId: selected.id }
            : {
                targetType: TargetType.Player,
                targetSlackId: selected.slackId,
              },
        });

        if (!attackResult.success) {
          const failureText = buildAttackFailureMessage(
            attackResult.message,
            selected,
          );
          await client.chat.postMessage({
            channel: channelId,
            text: failureText,
          });

          if (
            selected.kind === 'player' &&
            selected.slackId !== userId &&
            isMissingTargetCharacterMessage(attackResult.message)
          ) {
            try {
              const dm = await client.conversations.open({
                users: selected.slackId,
              });
              const dmChannelId =
                typeof dm.channel?.id === 'string' ? dm.channel.id : undefined;
              if (dmChannelId) {
                const attackerMention = userId ? `<@${userId}>` : 'Someone';
                await client.chat.postMessage({
                  channel: dmChannelId,
                  text: `${attackerMention} tried to attack you in *Mud*, but you don't have a character yet. Use "/mud ${COMMANDS.NEW} <name>" to jump in.`,
                });
              }
            } catch (notifyError) {
              console.warn(
                'Failed to notify target about missing character',
                notifyError,
              );
            }
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

        await client.chat.postMessage({
          channel: channelId,
          text: '⚔️ Combat initiated! Check your DMs for the results.',
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(err, 'Failed to attack');
        await client.chat.postMessage({ channel: channelId, text: message });
      }
    },
  );
};
